/**
 * Convert text into a URL-safe slug.
 * Used for generating image filenames from item names.
 */
export function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
}

/**
 * Get the image URL for an inventory item.
 * Falls back to a slugified filename in /IMAGES/items/ if no image_url is set.
 */
export function getItemImage(item) {
  if (!item) return null;
  if (item.image_url) return item.image_url;
  const slug = slugify(item.item_name);
  return slug ? `/IMAGES/items/${slug}.webp` : null;
}
