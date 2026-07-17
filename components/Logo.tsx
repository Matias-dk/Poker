/* eslint-disable @next/next/no-img-element */
// Det officielle Ranum-logo (public/logo.png), omfarvet til
// Summer School-udgavens gyldne gradient.
export default function Logo({ size = 64 }: { size?: number }) {
  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="Ranum Summer School logo"
      style={{ display: "block" }}
    />
  );
}
