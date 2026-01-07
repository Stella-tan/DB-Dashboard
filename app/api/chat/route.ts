import { streamText, convertToModelMessages, type UIMessage } from "ai"
import { openai } from "@ai-sdk/openai"
import { getSupabaseServerClient } from "@/lib/server"

export const maxDuration = 30

// Helper function to get model from string (e.g., "openai/gpt-4" -> openai("gpt-4"))
function getModel(modelString: string) {
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:9',message:'getModel called',data:{modelString,hasOpenAIKey:!!process.env.OPENAI_API_KEY},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY environment variable is required. " +
      "Please add it to your .env.local file. " +
      "Get your API key from https://platform.openai.com/api-keys"
    )
  }

  const parts = modelString.split("/")
  if (parts.length === 2 && parts[0] === "openai") {
    const modelName = parts[1]
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:20',message:'Returning OpenAI model',data:{modelName},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    return openai(modelName)
  }
  
  // Fallback: try to use as OpenAI model name directly
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:26',message:'Using modelString as OpenAI model name',data:{modelString},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  return openai(modelString)
}

// Helper function to check if a model is a reasoning model (doesn't support temperature)
function isReasoningModel(modelString: string): boolean {
  const parts = modelString.split("/")
  const modelName = parts.length === 2 ? parts[1] : modelString
  // Reasoning models: gpt-5, o1, o1-preview, o1-mini, etc.
  return modelName.startsWith("gpt-5") || modelName.startsWith("o1")
}

export async function POST(req: Request) {
  try {
    // #region agent log
    const requestBody = await req.json();
    const messages = requestBody.messages;
    const firstMessage = messages?.[0];
    fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:8',message:'After parsing request body',data:{messagesDefined:messages!==undefined,messagesIsArray:Array.isArray(messages),messagesLength:messages?.length||0,messagesType:typeof messages,requestBodyKeys:Object.keys(requestBody||{}),firstMessageKeys:firstMessage?Object.keys(firstMessage):null,firstMessageRole:firstMessage?.role,firstMessageHasParts:firstMessage?.parts!==undefined,firstMessagePartsLength:firstMessage?.parts?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
    // #endregion

    // Get chatbot and database context from headers
    const chatbotId = req.headers.get("x-chatbot-id")
    const databaseId = req.headers.get("x-database-id")

    if (!chatbotId) {
      return Response.json({ error: "Chatbot ID required" }, { status: 400 })
    }

    const db = await getSupabaseServerClient()

    // Fetch chatbot configuration
    const chatbotResult = await db
      .from("chatbots")
      .select("*")
      .eq("id", chatbotId)
      .single()

    if (chatbotResult.error || !chatbotResult.data) {
      return Response.json({ error: "Chatbot not found" }, { status: 404 })
    }
    
    const chatbot = chatbotResult.data

    // Check chatbot has access to the database
    if (databaseId) {
      const accessResult = await db
        .from("chatbot_database_access")
        .select("*")
        .eq("chatbot_id", chatbotId)
        .eq("database_id", databaseId)
        .single()

      if (accessResult.error || !accessResult.data) {
        return Response.json({ error: "Chatbot does not have access to this database" }, { status: 403 })
      }

      // Get database and table information for context
      const dbInfoResult = await db.from("external_databases").select("name").eq("id", databaseId).single()
      const database = dbInfoResult.data

      const tablesResult = await db
        .from("synced_tables")
        .select(["table_name", "schema_definition"])
        .eq("database_id", databaseId)
        .executeQuery()
      
      const tables = tablesResult.data

      // Enhance system prompt with database context
      let enhancedSystemPrompt = chatbot.system_prompt

      if (database && tables && tables.length > 0) {
        enhancedSystemPrompt += `\n\nYou have access to the "${database.name}" database with the following tables:\n`
        tables.forEach((table) => {
          enhancedSystemPrompt += `- ${table.table_name}\n`
        })
        enhancedSystemPrompt += "\nUse this information to provide accurate and relevant responses about the data."
      }

      // #region agent log
      const prompt = await convertToModelMessages(messages);
      const promptKeys = prompt && typeof prompt === 'object' ? Object.keys(prompt) : null;
      fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:67',message:'After convertToModelMessages (with database)',data:{promptDefined:prompt!==undefined,promptIsArray:Array.isArray(prompt),promptLength:prompt?.length||0,promptType:typeof prompt,promptIsNull:prompt===null,promptKeys:promptKeys,promptStringified:JSON.stringify(prompt).substring(0,200)},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
      // #endregion

      // #region agent log
      const model = getModel(chatbot.model || "openai/gpt-4-turbo");
      const modelString = chatbot.model || "openai/gpt-4-turbo";
      const isReasoning = isReasoningModel(modelString);
      fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:110',message:'Before streamText call (with database)',data:{promptIsArray:Array.isArray(prompt),promptLength:prompt?.length||0,modelString,isReasoning,hasSystemPrompt:!!enhancedSystemPrompt},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      const streamTextOptions: any = {
        model,
        prompt,
        system: enhancedSystemPrompt,
        abortSignal: req.signal,
      }
      // Reasoning models don't support temperature
      if (!isReasoning) {
        streamTextOptions.temperature = chatbot.temperature || 0.7
      }
      const result = streamText(streamTextOptions)

      return result.toUIMessageStreamResponse()
    }

    // #region agent log
    const prompt = await convertToModelMessages(messages);
    fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:88',message:'After convertToModelMessages (no database)',data:{promptDefined:prompt!==undefined,promptIsArray:Array.isArray(prompt),promptLength:prompt?.length||0,promptType:typeof prompt,promptIsNull:prompt===null},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // #region agent log
    const model = getModel(chatbot.model || "openai/gpt-4-turbo");
    const modelString = chatbot.model || "openai/gpt-4-turbo";
    const isReasoning = isReasoningModel(modelString);
    fetch('http://127.0.0.1:7242/ingest/97001708-936e-4cc9-9da1-b0a328d5f138',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'app/api/chat/route.ts:135',message:'Before streamText call (no database)',data:{promptIsArray:Array.isArray(prompt),promptLength:prompt?.length||0,modelString,isReasoning,hasSystemPrompt:!!chatbot.system_prompt},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    const streamTextOptions: any = {
      model,
      prompt,
      system: chatbot.system_prompt,
      abortSignal: req.signal,
    }
    // Reasoning models don't support temperature
    if (!isReasoning) {
      streamTextOptions.temperature = chatbot.temperature || 0.7
    }
    const result = streamText(streamTextOptions)

    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.error("[v0] Chat API error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
