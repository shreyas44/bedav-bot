import express, { application, query, RequestHandler } from "express"
import bodyParser from "body-parser"
import axios from "axios"
require("dotenv").config()

interface Hospital {
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

const cityKey: {
  [prop: string]: string
} = {
  bangalore: "bengaluru-karnataka",
  bengaluru: "bengaluru-karnataka",
  pune: "pune-maharashtra",
}

const sendWhatsappMsg = async (
  number: number,
  message: string
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
          type: "text",
          text: message,
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

const getGraphQlQuery = (city: string, query: string): string => {
  const graphqlQuery = `
    query {
      locality(name: "${city}") {
        hospitals(first: 10, searchQuery: "${query}") {
          edges {
            node {
              name
              icuAvailable
              hduAvailable                
              oxygenAvailable
              generalAvailable
              ventilatorsAvailable
              icuTotal
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
            }
          }
        }
      }
    }
  `

  return graphqlQuery
}

const getHospitals = async (
  query: string,
  variables: object = {}
): Promise<{ data: Hospital[] | null; error: any }> => {
  const ret = {
    data: null,
    error: null,
  }

  try {
    const response = await axios.post("https://bedav.org/graphql", {
      query,
      variables,
    })
    const { data } = response.data
    const { edges } = data.locality.hospitals
    const hospitals = edges.map((item: { node: any }) => item.node)

    ret.data = hospitals
  } catch (error) {
    ret.error = error
  }

  return ret
}

const getFormattedHospital = (hospital: Hospital, index: number): string => {
  const formattedString = `
    *${index}. ${hospital.name}*
    _ICU Available_: ${hospital.icuAvailable}
    _HDU Available_: ${hospital.hduAvailable}
    _General Available_: ${hospital.generalAvailable}
    _Oxygen Available_: ${hospital.oxygenAvailable}
    _Ventilators Available_: ${hospital.ventilatorsAvailable}
    _Phone_: ${hospital.phone}
    _Website_: ${hospital.website}
  `

  return formattedString
}

const getFormattedHospitals = (hospitals: Hospital[]): string => {
  const formattedHospitals = hospitals.map((hospital, index) => {
    return getFormattedHospital(hospital, index + 1)
  })

  const message = formattedHospitals.reduce((final = "", hospital) => {
    final += hospital

    return final
  })

  return message
}

const app = express()

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

const handleInbound: RequestHandler = async (request, response) => {
  const number = request.body.from.number
  const content = request.body.message.content
  const text: string = content.text.toLowerCase().trim()

  if (text.startsWith("search for")) {
    let remaining = text.split("search for")[1].trim()

    if (remaining.includes("in")) {
      const split = remaining.split("in")
      const city = split[split.length - 1].trim()
      const searchQuery = split.slice(0, split.length - 1).join("in")
      const graphqlQuery = getGraphQlQuery(cityKey[city], searchQuery)
      const { data, error } = await getHospitals(graphqlQuery)

      if (!error) {
        const formatedHospitals = getFormattedHospitals(data)
        sendWhatsappMsg(number, formatedHospitals)
      }
    } else {
    }
  }

  response.status(200).end()
}

const handleStatus: RequestHandler = (request, response) => {
  console.log(request.body)
  response.status(200).end()
}

app.post("/webhooks/inbound", handleInbound)
app.post("/webhooks/status", handleStatus)
app.listen(3000, () => {
  console.log("Listening on port 3000")
})
