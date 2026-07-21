import { renderGuideOpenGraphImage } from "@/components/marketing/GuideOpenGraphImage";
import { getPublicGuide } from "@/lib/public-guides";

export const alt = "Crypto security basics with Bloquera";
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};

export default function CryptoSecurityBasicsOpenGraphImage() {
  const guide = getPublicGuide("crypto-security-basics");

  if (!guide) {
    throw new Error("Guide not found");
  }

  return renderGuideOpenGraphImage(guide);
}
