import { BadRequestException } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

export interface ValidatedStructuredContent {
  sanitizedData: any;
  assetIds: Set<string>;
  derivedPlainText: string;
}

const ALLOWED_BLOCKS = new Set([
  'Heading',
  'RichText',
  'Image',
  'TextImage',
  'ImageText',
  'Quote',
  'Gallery',
  'Divider',
]);

const ALLOWED_HTML_TAGS = [
  'p', 'strong', 'b', 'em', 'i', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'a', 'br', 'span', 'div'
];
const ALLOWED_HTML_ATTRIBUTES = {
  '*': ['style', 'class'],
  'a': ['href', 'target', 'rel']
};
const ALLOWED_HTML_SCHEMES = ['http', 'https', 'mailto'];

export function validateAndDeriveStructuredContent(data: any): ValidatedStructuredContent {
  if (!data || typeof data !== 'object') {
    throw new BadRequestException('structuredContent must be a valid JSON object');
  }

  if (Array.isArray(data)) {
    throw new BadRequestException('structuredContent cannot be an array');
  }

  const { root, content } = data;
  
  if (!root || typeof root !== 'object') {
    throw new BadRequestException('structuredContent.root must be an object');
  }

  if (!Array.isArray(content)) {
    throw new BadRequestException('structuredContent.content must be an array');
  }

  if (content.length > 50000) {
    throw new BadRequestException('structuredContent.content exceeds maximum blocks limit (50000)');
  }

  const assetIds = new Set<string>();
  let derivedPlainText = '';
  const sanitizedContent = [];

  const seenIds = new Set<string>();

  for (const block of content) {
    if (!block || typeof block !== 'object') {
      throw new BadRequestException('Block must be an object');
    }

    const { type, props } = block;

    if (!type || typeof type !== 'string' || !ALLOWED_BLOCKS.has(type)) {
      throw new BadRequestException(`Unknown block type: ${type}`);
    }

    if (!props || typeof props !== 'object') {
      throw new BadRequestException(`Block ${type} missing props`);
    }

    const { id, ...restProps } = props;
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException(`Block ${type} missing valid id`);
    }

    if (seenIds.has(id)) {
      throw new BadRequestException(`Duplicate component id: ${id}`);
    }
    seenIds.add(id);

    let sanitizedProps: any = { id };
    
    switch (type) {
      case 'Heading':
        if (typeof restProps.text !== 'string') throw new BadRequestException(`Heading ${id} missing text`);
        if (restProps.level && !['h2', 'h3'].includes(restProps.level)) throw new BadRequestException(`Heading ${id} invalid level`);
        
        sanitizedProps.text = restProps.text;
        sanitizedProps.level = restProps.level || 'h2';
        derivedPlainText += `${sanitizedProps.text}\n\n`;
        break;

      case 'RichText':
        if (typeof restProps.text !== 'string') throw new BadRequestException(`RichText ${id} missing text`);
        sanitizedProps.text = sanitizeHtml(restProps.text, {
          allowedTags: ALLOWED_HTML_TAGS,
          allowedAttributes: ALLOWED_HTML_ATTRIBUTES,
          allowedSchemes: ALLOWED_HTML_SCHEMES,
        });
        derivedPlainText += sanitizeHtml(sanitizedProps.text, { allowedTags: [] }) + '\n\n';
        break;

      case 'Image':
        if (typeof restProps.assetId !== 'string') throw new BadRequestException(`Image ${id} missing assetId`);
        sanitizedProps.assetId = restProps.assetId;
        sanitizedProps.alt = typeof restProps.alt === 'string' ? restProps.alt : '';
        sanitizedProps.caption = typeof restProps.caption === 'string' ? restProps.caption : undefined;
        if (restProps.size) sanitizedProps.size = restProps.size;
        if (restProps.alignment) sanitizedProps.alignment = restProps.alignment;
        if (restProps.radius) sanitizedProps.radius = restProps.radius;
        assetIds.add(sanitizedProps.assetId);
        
        if (sanitizedProps.caption) derivedPlainText += `${sanitizedProps.caption}\n\n`;
        else if (sanitizedProps.alt) derivedPlainText += `[Image: ${sanitizedProps.alt}]\n\n`;
        break;

      case 'TextImage':
      case 'ImageText':
        if (typeof restProps.assetId !== 'string') throw new BadRequestException(`${type} ${id} missing assetId`);
        if (typeof restProps.text !== 'string') throw new BadRequestException(`${type} ${id} missing text`);
        if (restProps.layout && !['50-50', '60-40'].includes(restProps.layout)) throw new BadRequestException(`${type} ${id} invalid layout`);
        
        sanitizedProps.assetId = restProps.assetId;
        sanitizedProps.text = sanitizeHtml(restProps.text, {
          allowedTags: ALLOWED_HTML_TAGS,
          allowedAttributes: ALLOWED_HTML_ATTRIBUTES,
          allowedSchemes: ALLOWED_HTML_SCHEMES,
        });
        sanitizedProps.layout = restProps.layout || '50-50';
        sanitizedProps.alt = typeof restProps.alt === 'string' ? restProps.alt : '';
        sanitizedProps.caption = typeof restProps.caption === 'string' ? restProps.caption : undefined;
        if (restProps.imageSize) sanitizedProps.imageSize = restProps.imageSize;
        if (restProps.imageAlignment) sanitizedProps.imageAlignment = restProps.imageAlignment;
        if (restProps.imageRadius) sanitizedProps.imageRadius = restProps.imageRadius;
        assetIds.add(sanitizedProps.assetId);
        
        derivedPlainText += sanitizeHtml(sanitizedProps.text, { allowedTags: [] }) + '\n\n';
        if (sanitizedProps.caption) derivedPlainText += `${sanitizedProps.caption}\n\n`;
        break;

      case 'Quote':
        if (typeof restProps.quote !== 'string') throw new BadRequestException(`Quote ${id} missing quote`);
        sanitizedProps.quote = sanitizeHtml(restProps.quote, { allowedTags: [] }); // No HTML in quote
        sanitizedProps.author = typeof restProps.author === 'string' ? sanitizeHtml(restProps.author, { allowedTags: [] }) : undefined;
        
        derivedPlainText += `"${sanitizedProps.quote}"\n`;
        if (sanitizedProps.author) derivedPlainText += `- ${sanitizedProps.author}\n`;
        derivedPlainText += '\n';
        break;

      case 'Gallery':
        if (!Array.isArray(restProps.images)) throw new BadRequestException(`Gallery ${id} images must be an array`);
        if (restProps.images.length > 20) throw new BadRequestException(`Gallery ${id} images exceed maximum limit (20)`);
        
        sanitizedProps.images = restProps.images.map((img: any, idx: number) => {
          if (!img || typeof img !== 'object' || typeof img.assetId !== 'string') {
            throw new BadRequestException(`Gallery ${id} image at index ${idx} missing valid assetId`);
          }
          assetIds.add(img.assetId);
          return {
            assetId: img.assetId,
            alt: typeof img.alt === 'string' ? img.alt : '',
            caption: typeof img.caption === 'string' ? img.caption : undefined,
          };
        });

        sanitizedProps.images.forEach((img: any) => {
          if (img.caption) derivedPlainText += `${img.caption}\n\n`;
        });
        break;

      case 'Divider':
        sanitizedProps = { id };
        break;
    }

    sanitizedContent.push({
      type,
      props: sanitizedProps
    });
  }

  return {
    sanitizedData: {
      root: {}, // Keep root minimal for V1
      content: sanitizedContent
    },
    assetIds,
    derivedPlainText: derivedPlainText.trim()
  };
}
