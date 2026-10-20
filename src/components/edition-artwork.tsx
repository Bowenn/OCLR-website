import Image from "next/image";
/** Artwork is presentation only; it never publishes an edition or opens entry. */
export function EditionArtwork({ slug }: { slug: string }) {
  return (
    <div
      className={`edition-art${slug === "s11" ? " edition-art-s11" : ""}`}
      aria-hidden="true"
    >
      {slug === "s11" ? (
        <Image
          src="/oclr-s11-square-logo.webp"
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
