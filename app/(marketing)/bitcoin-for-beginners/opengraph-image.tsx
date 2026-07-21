import { renderGuideOpenGraphImage } from "@/components/marketing/GuideOpenGraphImage";
import { getPublicGuide } from "@/lib/public-guides";

export const alt = "Bitcoin for beginners with Bloquera";
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};

export default function BitcoinForBeginnersOpenGraphImage() {
  const guide = getPublicGuide("bitcoin-for-beginners");

  if (!guide) {
    throw new Error("Guide not found");
  }

  return renderGuideOpenGraphImage(guide);
}
