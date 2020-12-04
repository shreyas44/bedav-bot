import express, { RequestHandler } from "express"
import bodyParser from "body-parser"
import {
  getSearchGraphQlQuery,
  getHospitals,
  sendMessage,
  getFormattedHospitals,
  getHospitalGraphQLQuery,
  runQuery,
  fixedMessages,
} from "./utils"
import { encode } from "js-base64"
import { ToInfo } from "./types"
require("dotenv").config()

const cityKey: {
  [city: string]: string
} = {
  bangalore: "bengaluru-karnataka",
  bengaluru: "bengaluru-karnataka",

  // MH
  pune: "pune-maharashtra",
  kohlapur: "kohlapur-maharashtra",
  sangli: "sangli-maharashtra",
  satara: "satara-maharashtra",
  solapur: "solapur-maharashtra",

  // AP
  anatapur: "anatapur-andhra pradesh",
  chittoor: "chittoor-andhra pradesh",
  "east godavari": "east godavari-andhra pradesh",
  guntur: "guntur-andhra pradesh",
  krishna: "krishna-andhra pradesh",
  kurnool: "kurnool-andhra pradesh",
  prakasam: "prakasam-andhra pradesh",
  nellore: "spsr nellore-andhra pradesh",
  srikakulam: "srikakulam-andhra pradesh",
  vishakapatanam: "vishakapatanam-andhra pradesh",
  vizianagaram: "vizianagaram-andhra pradesh",
  "west godavari": "west godavari-andhra pradesh",
  kadapa: "kadapa-andhra pradesh",
}

const handleSearch = async (message: string, to: ToInfo) => {
  let remaining = message.split("search")[1].trim()

  if (remaining.includes("in")) {
    const split = remaining.split("in")
    const city = split[split.length - 1].trim()
    const searchQuery = split.slice(0, split.length - 1).join("in")
    const graphqlQuery = getSearchGraphQlQuery(cityKey[city], searchQuery)
    const { data, error } = await getHospitals(graphqlQuery)

    if (!error) {
      if (data?.length === 0) {
        sendMessage(
          to,
          "Sorry, there were no hospitals that matched your search 🙁"
        )
      } else {
        const formatedHospitals = getFormattedHospitals(data!)
        sendMessage(to, formatedHospitals)
      }
    }
  }
}

const handleDirections = async (message: string, to: ToInfo) => {
  let remaining = message.split("get directions to")[1].trim()
  let hospitalId: number | string

  try {
    hospitalId = parseInt(remaining)
  } catch (error) {
    sendMessage(to, "Please enter a valid Hospital ID")
  }

  hospitalId = encode(`Hospital:${hospitalId!}`)

  const graphqlQuery = getHospitalGraphQLQuery(hospitalId)
  const { data, error } = await runQuery(graphqlQuery)

  if (!error) {
    const { hospital } = data

    if (to.type === "whatsapp") {
      sendMessage(
        to,
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
    } else if (to.type === "messenger") {
      sendMessage(
        to,
        `https://maps.google.com/maps?q=${hospital.latitude},${hospital.longitude}\n*${hospital.name}*\n${hospital.address}\n`
      )
    }
  } else {
    sendMessage(to, "Please enter a valid Hospital ID")
  }
}

const handleInbound: RequestHandler = async (request, response) => {
  const content = request.body.message.content
  const text = content.text.toLowerCase().trim()
  const to: ToInfo = request.body.from

  if (text.startsWith("search")) {
    handleSearch(text, to)
  } else if (text.startsWith("get directions to")) {
    handleDirections(text, to)
  } else if (["help", "hi"].includes(text)) {
    sendMessage(to, fixedMessages.help)
  } else if (text === "cities") {
    sendMessage(to, fixedMessages.cities)
  } else {
    sendMessage(
      to,
      `Sorry, invalid message. Please try again\n${fixedMessages.help}`
    )
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
