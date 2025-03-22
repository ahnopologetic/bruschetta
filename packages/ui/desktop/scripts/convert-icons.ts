import sharp from 'sharp'
import { join } from 'path'

const ICONS = ['icon', 'icon-focus', 'icon-break']
const SIZES = [16, 32, 128, 256, 512] // Various sizes for different contexts

async function convertIcons() {
  for (const icon of ICONS) {
    for (const size of SIZES) {
      await sharp(join(__dirname, '..', 'resources', `${icon}.svg`))
        .resize(size, size)
        .png()
        .toFile(join(__dirname, '..', 'resources', `${icon}${size === 16 ? '' : `@${size}`}.png`))
    }
  }
}

convertIcons().catch(console.error)
