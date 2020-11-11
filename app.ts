import express, { application, query, RequestHandler } from "express"
import bodyParser from "body-parser"
import axios from "axios"
import { isPropertyAccessChain } from "typescript"
require("dotenv").config()

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
              generalAvailable
              latitude
              longitude
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
): Promise<{ data: object | null; error: any }> => {
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
        sendWhatsappMsg(number, JSON.stringify(data))
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
