const categoryAssetModules = import.meta.glob('../assets/categories/*.{png,jpg,jpeg,webp,avif,svg}', {
  eager: true,
  import: 'default',
}) as Record<string, string>

const categoryAssetMap = Object.fromEntries(
  Object.entries(categoryAssetModules).map(([path, assetUrl]) => {
    const fileName = path.split('/').pop()?.replace(/\.[^.]+$/, '') ?? ''
    return [fileName, assetUrl]
  }),
)

export function getCategoryAsset(categoryId: string): string | null {
  return categoryAssetMap[categoryId] ?? null
}
