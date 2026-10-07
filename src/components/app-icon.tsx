/** Ícono compartido por /icon y /apple-icon (renderizado con ImageResponse). */
export function AppIcon({ size }: { size: number }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #171717 0%, #404040 100%)",
        color: "#fafafa",
        fontSize: size * 0.58,
        fontWeight: 700,
      }}
    >
      $
    </div>
  )
}
