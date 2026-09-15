import React from "react";

export default function QuizLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <section>{children}</section>;
}