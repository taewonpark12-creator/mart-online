export const metadata = {
  robots: "noindex, nofollow",
};

export default function GoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
