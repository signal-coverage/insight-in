import { HOME_HREF, HOME_LABEL } from "./consts";
import type { Crumb } from "./types";

const safeDecode = (segment: string): string => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

export const formatSegment = (segment: string): string => {
  const words = safeDecode(segment).replace(/-/g, " ").trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const buildCrumbs = (pathname: string): Crumb[] => {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: HOME_LABEL, href: HOME_HREF }];

  segments.forEach((segment, index) => {
    if (`/${segment}` === HOME_HREF) return;

    crumbs.push({
      label: formatSegment(segment),
      href: `/${segments.slice(0, index + 1).join("/")}`,
    });
  });

  const last = crumbs.length - 1;
  crumbs[last] = { label: crumbs[last].label };

  return crumbs;
};
