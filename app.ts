import express, { RequestHandler } from "express"
import bodyParser from "body-parser"
import {
  getSearchGraphQlQuery,
  getHospitals,
  sendWhatsappMsg,
  getFormattedHospitals,
  getHospitalGraphQLQuery,
  runQuery,
} from "./utils"
import { encode } from "js-base64"
require("dotenv").config()

const cityKey: {
  [prop: string]: string
} = {
  bangalore: "bengaluru-karnataka",
  bengaluru: "bengaluru-karnataka",
  pune: "pune-maharashtra",
}

const helpMessage = `
You can use the following commands:
1. *help* - Get this menu and all the commands you can use
2. *search* _<hospital-name>_ *in* _<location>_ - Search for a hospital in a particual location. For example, "search for sakra in bangalore" searches for hospitals with the name sakra in bangalore
3. *get directions to* _<hospital-id>_ - Get directions to a hospital with a particular ID. You can get the hospital ID from the search results. The serial number preceding the Hospital name is the Hospital ID. For example if the search result has _(87) Sakra Hospital_, send _get directions to 87_ to get directions to Sakra Hospital.
`

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
  const text = content.text.toLowerCase().trim()

  if (text.startsWith("search")) {
    let remaining = text.split("search")[1].trim()

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
  } else if (text.startsWith("get directions to")) {
    let remaining = text.split("get directions to")[1].trim()
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
  } else if (text.startsWith("help") || text === "hi") {
    sendWhatsappMsg(number, helpMessage)
  }

  response.status(200).end()
}

const handleStatus: RequestHandler = (request, response) => {
  response.status(200).end()
}

app.post("/webhooks/inbound", handleInbound)
app.post("/webhooks/status", handleStatus)
app.listen(3000, () => {
  console.log("Listening on port 3000")
})
