import { renderGuideOpenGraphImage } from "@/components/marketing/GuideOpenGraphImage";
import { getPublicGuide } from "@/lib/public-guides";

export const alt = "What is Bitcoin with Bloquera";
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};

export default function WhatIsBitcoinOpenGraphImage() {
  const guide = getPublicGuide("what-is-bitcoin");

  if (!guide) {
    throw new Error("Guide not found");
  }

  return renderGuideOpenGraphImage(guide);
}
