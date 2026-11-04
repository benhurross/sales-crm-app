// eslint-disable-next-line @typescript-eslint/no-unused-vars
type LayoutProps<_P extends string = "/"> = {
  children: React.ReactNode;
  params: Promise<Record<string, string>>;
};
