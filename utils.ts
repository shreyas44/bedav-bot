import axios from "axios"
import { decode } from "js-base64"
import { Hospital, Platform, ToInfo } from "./types"

export const fixedMessages = {
  help: `
The Bedav bot is here to help you find a hospital with available beds
You can use the following commands:
1. *help* - Get this menu and all the commands you can use
2. *cities* - Get a list of all the cities available
2. *search* _<hospital-name>_ *in* _<location>_ - Search for a hospital in a particual location. For example, "search for sakra in bangalore" searches for hospitals with the name sakra in bangalore
3. *get directions to* _<hospital-id>_ - Get directions to a hospital with a particular ID. You can get the hospital ID from the search results. The serial number preceding the Hospital name is the Hospital ID. For example if the search result has _(87) Sakra Hospital_, send _get directions to 87_ to get directions to Sakra Hospital.
`,
  cities: `
The cities/districts currently available are:

*Karnataka*
  1. Bangalore/Bengaluru

*Maharashtra*
  2. Pune
  3. Kohlapur
  4. Sangli
  5. Satara
  6. Solapur

*Andhra Pradhesh*
  7. Anantapur
  8. Chittoor
  9. East Godavari
 10. Guntur
 11. Krishna
 12. Kurnool
 13. Prakasam
 14. Nellore
 15. Srikakulam
 16. Vishakapatanam
 17. Vizianagaram
 18. West Godavari
 19. Kadapa
`,
  faq: "",
}

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

export const getHospitalId = (encodedId: string) => {
  return decode(encodedId).slice(9)
}

export const sendMessage = async (
  to: ToInfo,
  message: any,
  type: string = "text"
): Promise<void> => {
  let from: { type: Platform; number?: string; id?: string } = {
    type: to.type,
  }

  if (to.type === "whatsapp") {
    from.number = "14157386170"
  } else if (to.type === "messenger") {
    from.id = "107083064136738"
  }

  await axios.post(
    "https://messages-sandbox.nexmo.com/v0.1/messages",
    {
      from,
      to,
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
  index: number | string
): string => {
  const roundedString = (occupied: number, total: number) => {
    return `${Math.floor((occupied * 100) / total)}% Occupied`
  }

  let formattedString = `*(${index}) ${hospital.name}*\n`

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
    return getFormattedHospital(hospital, getHospitalId(hospital.id))
  })

  const message = formattedHospitals.reduce((final, hospital) => {
    final += "\n" + hospital

    return final
  })

  return message
}
