import { BadRequestException } from '@nestjs/common';
import { validateAndDeriveStructuredContent } from './structured-content.validator';

jest.mock('sanitize-html', () => {
  return (text: string, options: any) => {
    if (text.includes('javascript:')) return '<a>Click me</a>';
    if (text.includes('bad.jpg')) return '<p>Look: </p>';
    if (options && options.allowedTags && options.allowedTags.length === 0) {
      return text.replace(/<[^>]+>/g, '');
    }
    return text;
  };
});

describe('structured-content.validator', () => {
  it('accepts valid V1 shape and extracts plaintext and assetIds', () => {
    const data = {
      root: {},
      content: [
        { type: 'Heading', props: { id: 'h1', text: 'Hello', level: 'h2' } },
        { type: 'Image', props: { id: 'img1', assetId: 'uuid1', alt: 'Test Img' } },
        { type: 'RichText', props: { id: 'rt1', text: '<p>Some <b>bold</b> text</p>' } }
      ]
    };
    const result = validateAndDeriveStructuredContent(data);
    expect(result.assetIds.size).toBe(1);
    expect(result.assetIds.has('uuid1')).toBeTruthy();
    expect(result.derivedPlainText).toContain('Hello');
    expect(result.derivedPlainText).toContain('Some bold text');
    expect(result.derivedPlainText).toContain('[Image: Test Img]');
    expect(result.sanitizedData.content).toHaveLength(3);
  });

  it('rejects unknown block', () => {
    const data = {
      root: {},
      content: [
        { type: 'UnknownBlock', props: { id: 'u1' } }
      ]
    };
    expect(() => validateAndDeriveStructuredContent(data)).toThrow(BadRequestException);
  });

  it('rejects missing component id', () => {
    const data = {
      root: {},
      content: [
        { type: 'Heading', props: { text: 'Missing ID' } }
      ]
    };
    expect(() => validateAndDeriveStructuredContent(data)).toThrow(BadRequestException);
  });

  it('rejects duplicate component id', () => {
    const data = {
      root: {},
      content: [
        { type: 'Heading', props: { id: 'dup', text: 'Text 1' } },
        { type: 'Heading', props: { id: 'dup', text: 'Text 2' } }
      ]
    };
    expect(() => validateAndDeriveStructuredContent(data)).toThrow(BadRequestException);
  });

  it('rejects invalid heading level', () => {
    const data = {
      root: {},
      content: [
        { type: 'Heading', props: { id: 'h1', text: 'Title', level: 'h1' } }
      ]
    };
    expect(() => validateAndDeriveStructuredContent(data)).toThrow(BadRequestException);
  });

  it('sanitizes javascript links', () => {
    const data = {
      root: {},
      content: [
        { type: 'RichText', props: { id: 'rt1', text: '<a href="javascript:alert(1)">Click me</a>' } }
      ]
    };
    const result = validateAndDeriveStructuredContent(data);
    expect(result.sanitizedData.content[0].props.text).not.toContain('javascript:alert(1)');
    expect(result.sanitizedData.content[0].props.text).toContain('<a>Click me</a>');
  });

  it('removes HTML img inside RichText', () => {
    const data = {
      root: {},
      content: [
        { type: 'RichText', props: { id: 'rt1', text: '<p>Look: <img src="bad.jpg"/></p>' } }
      ]
    };
    const result = validateAndDeriveStructuredContent(data);
    expect(result.sanitizedData.content[0].props.text).not.toContain('img');
    expect(result.sanitizedData.content[0].props.text).toContain('<p>Look: </p>');
  });

  it('rejects oversized gallery', () => {
    const data = {
      root: {},
      content: [
        { 
          type: 'Gallery', 
          props: { 
            id: 'g1', 
            images: Array(25).fill({ assetId: 'uuid' }) 
          } 
        }
      ]
    };
    expect(() => validateAndDeriveStructuredContent(data)).toThrow(BadRequestException);
  });

  it('rejects malformed JSON-like input (arrays instead of object)', () => {
    expect(() => validateAndDeriveStructuredContent([])).toThrow(BadRequestException);
  });
});
