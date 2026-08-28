import type { ElementType, ReactNode } from "react";

const widths = {
  page: "max-w-[75rem]", // 1200px — public / student shell
  wide: "max-w-[60rem]",
  content: "max-w-[42rem]",
  reading: "max-w-[44rem]", // ~68ch for long-form
} as const;

export function Container({
  as: Tag = "div",
  size = "page",
  className = "",
  children,
}: {
  as?: ElementType;
  size?: keyof typeof widths;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag className={`mx-auto w-full px-5 sm:px-6 ${widths[size]} ${className}`}>
      {children}
    </Tag>
  );
}
