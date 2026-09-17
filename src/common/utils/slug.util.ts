export function generateSlug(text: string): string {
  return text
    .toString()
    .normalize('NFD') // divide caracteres acentuados
    .replace(/[\u0300-\u036f]/g, '') // quita los acentos
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // espacios por guiones
    .replace(/[^\w-]+/g, '') // quita caracteres que no sean palabra o guion
    .replace(/--+/g, '-'); // quita guiones múltiples
}
