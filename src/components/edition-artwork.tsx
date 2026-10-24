import { useAppTranslations } from "@/i18n/shared";
import Image from "next/image";
/** Artwork is presentation only; it never publishes an edition or opens entry. */
export function EditionArtwork({
  slug,
  logo,
}: {
  slug: string;
  logo?: string | null;
}) {
  const tr = useAppTranslations();

  const image =
    logo === undefined && slug === "s11" ? "/oclr-s11-square-logo.webp" : logo;
  const landscape =
    image === "/archive/s9/thumbnail.png" ||
    image === "/archive/s8/thumbnail.jpg" ||
    image === "/archive/s7/key-visual.jpg";
  return (
    <div
      className={`edition-art${image ? " edition-art-branded" : ""}${image === "/oclr-s11-square-logo.webp" ? " edition-art-s11" : ""}`}
      aria-hidden="true"
    >
      {image ? (
        <Image
          src={image}
          unoptimized
          alt=""
          width={landscape ? 1920 : 1200}
          height={landscape ? 1080 : 1200}
          sizes="(max-width: 760px) 240px, 220px"
        />
      ) : (
        <span>
          OCLR<small>{tr("THE ROOKIE STAGE")}</small>
        </span>
      )}
    </div>
  );
}
