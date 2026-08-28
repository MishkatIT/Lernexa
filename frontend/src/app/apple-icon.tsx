import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The three-bar mark on paper, generated at build time — no binary asset to commit.
export default function AppleIcon() {
  const bar = { width: 108, borderRadius: 4, background: "#14161A" };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FAF8F4",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <div style={{ ...bar, height: 28 }} />
        <div style={{ ...bar, height: 28 }} />
        <div
          style={{
            width: 108,
            height: 28,
            borderRadius: 4,
            border: "5px solid #14161A",
          }}
        />
      </div>
    ),
    size,
  );
}
