import express, { RequestHandler } from "express"
import bodyParser from "body-parser"
import {
  getSearchGraphQlQuery,
  getHospitals,
  sendWhatsappMsg,
  getFormattedHospitals,
  getHospitalGraphQLQuery,
  runQuery,
  fixedMessages,
} from "./utils"
import { encode } from "js-base64"
require("dotenv").config()

const cityKey: {
  [city: string]: string
} = {
  bangalore: "bengaluru-karnataka",
  bengaluru: "bengaluru-karnataka",
  pune: "pune-maharashtra",
}

const handleSearch = async (message: string, number: number) => {
  let remaining = message.split("search")[1].trim()

  if (remaining.includes("in")) {
    const split = remaining.split("in")
    const city = split[split.length - 1].trim()
    const searchQuery = split.slice(0, split.length - 1).join("in")
    const graphqlQuery = getSearchGraphQlQuery(cityKey[city], searchQuery)
    const { data, error } = await getHospitals(graphqlQuery)

    if (!error) {
      if (data?.length === 0) {
        sendWhatsappMsg(
          number,
          "Sorry, there were no hospitals that matched your search 🙁"
        )
      } else {
        const formatedHospitals = getFormattedHospitals(data!)
        sendWhatsappMsg(number, formatedHospitals)
      }
    }
  }
}

const handleDirections = async (message: string, number: number) => {
  let remaining = message.split("get directions to")[1].trim()
  let hospitalId: number | string

  try {
    hospitalId = parseInt(remaining)
  } catch (error) {
    sendWhatsappMsg(number, "Please enter a valid Hospital ID")
  }

  hospitalId = encode(`Hospital:${hospitalId!}`)

  const graphqlQuery = getHospitalGraphQLQuery(hospitalId)
  const { data, error } = await runQuery(graphqlQuery)

  if (!error) {
    const { hospital } = data
    sendWhatsappMsg(
      number,
      {
        type: "location",
        location: {
          longitude: hospital.longitude,
          latitude: hospital.latitude,
          name: hospital.name,
          address: hospital.address,
        },
      },
      "custom"
    )
  } else {
    sendWhatsappMsg(number, "Please enter a valid Hospital ID")
  }
}

const handleInbound: RequestHandler = async (request, response) => {
  const number = request.body.from.number
  const content = request.body.message.content
  const text = content.text.toLowerCase().trim()

  if (text.startsWith("search")) {
    handleSearch(text, number)
  } else if (text.startsWith("get directions to")) {
    handleDirections(text, number)
  } else if (text.startsWith("help") || text === "hi") {
    sendWhatsappMsg(number, fixedMessages.help)
  }

  response.status(200).end()
}

const handleStatus: RequestHandler = (request, response) => {
  response.status(200).end()
}

const app = express()

app.use(bodyParser.json())
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

app.post("/webhooks/inbound", handleInbound)
app.post("/webhooks/status", handleStatus)
app.listen(3000, () => {
  console.log("Listening on port 3000")
})
