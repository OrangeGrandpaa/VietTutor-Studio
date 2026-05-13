"use client";

import { useLayoutEffect, useRef } from "react";

import { Textarea } from "@/components/ui/textarea";

type AutoResizeTextareaProps = React.ComponentProps<typeof Textarea>;

export function AutoResizeTextarea({ value, onChange, style, ...props }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);

  return (
    <Textarea
      {...props}
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      style={{
        minHeight: "44px",
        overflow: "hidden",
        resize: "none",
        ...style
      }}
    />
  );
}
