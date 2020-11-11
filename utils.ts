import axios from "axios"
import { query } from "express"
import { decode } from "js-base64"
import { Hospital } from "./types"

const hospitalFields = `
  id
  name
  icuAvailable
  hduAvailable                
  oxygenAvailable
  generalAvailable
  ventilatorsAvailable

  icuOccupied
  hduOccupied
  oxygenOccupied
  generalOccupied
  ventilatorsOccupied
  
  icuTotal
  hduTotal
  oxygenTotal
  generalTotal
  ventilatorsTotal
  address
  latitude
  longitude
  phone
  website
  city
  state
`

export const sendWhatsappMsg = async (
  number: number,
  message: any,
  type: string = "text"
): Promise<void> => {
  await axios.post(
    "https://messages-sandbox.nexmo.com/v0.1/messages",
    {
      from: {
        type: "whatsapp",
        number: "14157386170",
      },
      to: {
        type: "whatsapp",
        number: number,
      },
      message: {
        content: {
          type: type,
          [type]: message,
        },
      },
    },
    {
      auth: {
        username: process.env.VONAGE_API_KEY!,
        password: process.env.VONAGE_API_SECRET!,
      },
    }
  )
}

export const getSearchGraphQlQuery = (city: string, query: string): string => {
  const graphqlQuery = `
    query {
      locality(name: "${city}") {
        hospitals(first: 10, searchQuery: "${query}") {
          edges {
            node {
              ${hospitalFields} 
            }
          }
        }
      }
    }
  `

  return graphqlQuery
}

export const getHospitalGraphQLQuery = (id: string): string => {
  return `
    query {
      hospital(id: "${id}") {
        ${hospitalFields}
      }
    }
  `
}

export const runQuery = async (
  query: string,
  variables: object = {}
): Promise<{ data: any; error: any }> => {
  const ret = {
    data: null,
    error: null,
  }

  try {
    const response = await axios.post("https://bedav.org/graphql", {
      query,
      variables,
    })

    ret.data = response.data.data
  } catch (error) {
    ret.error = error
  }

  return ret
}

export const getHospitals = async (
  query: string,
  variables: object = {}
): Promise<{ data: Hospital[] | null; error: any }> => {
  let { data, error } = await runQuery(query, variables)

  if (error !== null) {
    return { data, error }
  }

  try {
    const { edges } = data.locality.hospitals
    data = edges.map((item: { node: any }) => item.node)
  } catch (err) {
    error = err
  }

  return { data, error }
}

export const getFormattedHospital = (
  hospital: Hospital,
  index: number
): string => {
  const roundedString = (occupied: number, total: number) => {
    return `${Math.floor((occupied * 100) / total)}% Occupied`
  }

  let formattedString = `*${index}. ${hospital.name}* (ID: ${decode(
    hospital.id
  ).slice(9)})\n`

  if (hospital.icuAvailable !== null && hospital.icuTotal !== 0) {
    formattedString += `    _ICU Available_: ${
      hospital.icuAvailable
    } (${roundedString(hospital.icuOccupied!, hospital.icuTotal!)})\n`
  }

  if (hospital.hduAvailable !== null && hospital.hduTotal !== 0) {
    formattedString += `    _HDU Available_: ${
      hospital.hduAvailable
    } (${roundedString(hospital.hduOccupied!, hospital.hduTotal!)})\n`
  }

  if (hospital.oxygenAvailable !== null && hospital.oxygenTotal !== 0) {
    formattedString += `    _Oxygen Available_: ${
      hospital.oxygenAvailable
    } (${roundedString(hospital.oxygenOccupied!, hospital.oxygenTotal!)})\n`
  }

  if (hospital.generalAvailable !== null && hospital.generalTotal !== 0) {
    formattedString += `    _General Available_: ${
      hospital.generalAvailable
    } (${roundedString(hospital.generalOccupied!, hospital.generalTotal!)})\n`
  }

  if (
    hospital.ventilatorsAvailable !== null &&
    hospital.ventilatorsTotal === 0
  ) {
    formattedString += `    _Ventilators Available_: ${
      hospital.ventilatorsAvailable
    } (${roundedString(
      hospital.ventilatorsOccupied!,
      hospital.ventilatorsTotal!
    )})\n`
  }

  if (hospital.phone !== null) {
    formattedString += `    _Phone_: ${hospital.phone}\n`
  }

  if (hospital.website !== null) {
    formattedString += `    _Website_: ${hospital.website}\n`
  }

  return formattedString
}

export const getFormattedHospitals = (hospitals: Hospital[]): string => {
  const formattedHospitals = hospitals.map((hospital, index) => {
    return getFormattedHospital(hospital, index + 1)
  })

  const message = formattedHospitals.reduce((final, hospital) => {
    final += "\n" + hospital

    return final
  })

  return message
}

export const getHelpMessage = () => {
  return
}
