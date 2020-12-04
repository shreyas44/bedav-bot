export interface Hospital {
  id: string
  name: string
  icuAvailable?: number
  hduAvailable?: number
  oxygenAvailable?: number
  ventilatorsAvailable?: number
  generalAvailable?: number

  icuTotal?: number
  hduTotal?: number
  oxygenTotal?: number
  ventilatorsTotal?: number
  generalTotal?: number

  icuOccupied?: number
  hduOccupied?: number
  oxygenOccupied?: number
  ventilatorsOccupied?: number
  generalOccupied?: number

  address?: string
  latitude?: number
  longitutde?: number

  phone?: string
  website?: string

  city: string
  state: string
}

export type Platform = "messenger" | "whatsapp"

export interface ToInfo {
  type: Platform
  number?: string
  id?: string
}
