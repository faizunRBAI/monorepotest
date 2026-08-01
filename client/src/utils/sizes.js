// Age-based sizes (picked in the admin panel for baby/kids items) are told apart
// from letter sizes by their wording, so the storefront can group them under
// separate "Size" and "Age" headings.
export const isAgeSize = (size) => /month|year/i.test(size);
