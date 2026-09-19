const SRC = "https://www.lumeramd.com/cdn/shop/files/LumerMD_Logo.png?width=240";

/**
 * The source image is an opaque white square. On light backgrounds it's multiply-blended so the
 * white drops out; on the violet brand color it's recolored to white (grayscale → invert) and
 * screen-blended so its now-black background disappears.
 */
export default function BrandLogo({
  variant = "color",
  className = "h-28 w-28",
}: {
  variant?: "color" | "white";
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={SRC}
      alt="LumeraMD"
      className={`object-contain ${
        variant === "white"
          ? "mix-blend-screen [filter:grayscale(1)_invert(1)_brightness(1.6)]"
          : "mix-blend-multiply"
      } ${className}`}
    />
  );
}
