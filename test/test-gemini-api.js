require("dotenv").config();
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { StateGraph, MessagesAnnotation } = require("@langchain/langgraph");
const { HumanMessage } = require("@langchain/core/messages");

const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GOOGLE_API_KEY,
});

// A node is just a function: receives state, returns state update
async function callModel(state) {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

// Build the graph: one node, start → callModel → end
const graph = new StateGraph(MessagesAnnotation)
  .addNode("callModel", callModel)
  .addEdge("__start__", "callModel")
  .addEdge("callModel", "__end__")
  .compile();

async function test() {
  const result = await graph.invoke({
    messages: [new HumanMessage("Hello, are you working?")],
  });

  const lastMessage = result.messages[result.messages.length - 1];
  console.log(lastMessage.content);
}

test();
