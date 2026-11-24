/** Plain shapes shared by the ads modules. */

export interface BrandColor {
  name: string;
  hex: string;
}

export interface BrandData {
  name: string;
  colors: BrandColor[];
  fonts: { heading: string; body: string };
  tone: string;
  wordsToUse: string[];
  wordsToAvoid: string[];
}

export interface ProductData {
  name: string;
  description: string;
  benefits: string[];
  audience: string;
  price: string;
  link: string;
}
