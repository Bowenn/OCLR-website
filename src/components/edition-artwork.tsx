import Image from "next/image";
/** Artwork is presentation only; it never publishes an edition or opens entry. */
export function EditionArtwork({
  slug,
  logo,
}: {
  slug: string;
  logo?: string | null;
}) {
  const image =
    logo === undefined && slug === "s11" ? "/oclr-s11-square-logo.webp" : logo;
  return (
    <div
      className={`edition-art${image ? " edition-art-branded" : ""}`}
      aria-hidden="true"
    >
      {image ? (
        <Image
          src={image}
          unoptimized
          alt=""
          width={1200}
          height={1200}
          sizes="(max-width: 760px) 240px, 220px"
        />
      ) : (
        <span>
          OCLR<small>THE ROOKIE STAGE</small>
        </span>
      )}
    </div>
  );
}
