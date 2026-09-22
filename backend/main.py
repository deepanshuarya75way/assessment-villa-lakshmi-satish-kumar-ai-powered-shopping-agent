import json
import os
import tempfile
import sqlite3

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from shopping_agent import agent

import uuid

from setup_db import (
    create_database,
    create_chat_session,
    save_messages,
    get_chat_history
)

DB_PATH  = os.path.join(
    os.path.dirname(__file__),
    "store.db"
)


# ============================================================
# FASTAPI APPLICATION
# ============================================================

app = FastAPI(
    title="ShopAI API",
    description="AI Shopping Assistant Backend",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://ai-powered-shopping-agent-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# EXTRACT FINAL AI RESPONSE
# ============================================================

def extract_response(result):
    """
    Extract only the final AI-generated text response.

    Tool messages are intentionally ignored so internal tool
    output such as search_products JSON is never displayed
    directly to the user.
    """

    messages = result.get("messages", [])

    # Search from the newest message to the oldest.
    for message in reversed(messages):

        # LangChain AI messages normally have type == "ai".
        message_type = getattr(
            message,
            "type",
            "",
        )

        if message_type != "ai":
            continue

        content = getattr(
            message,
            "content",
            None,
        )

        if not content:
            continue

        # ----------------------------------------------------
        # Normal string response
        # ----------------------------------------------------

        if isinstance(content, str):

            text = content.strip()

            if text:
                return text


        # ----------------------------------------------------
        # Structured content blocks
        # ----------------------------------------------------

        if isinstance(content, list):

            text_parts = []

            for block in content:

                if isinstance(block, str):

                    text_parts.append(block)

                elif isinstance(block, dict):

                    block_text = block.get("text")

                    if block_text:
                        text_parts.append(
                            block_text
                        )


            response = "".join(
                text_parts
            ).strip()


            if response:
                return response


    return (
        "I couldn't generate a response. "
        "Please try again."
    )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "ShopAI API is running"
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "ok"
    }


# ============================================================
# CHAT
# ============================================================

@app.post("/chat")
def chat(
    message: str = Form(...),
    history: str = Form("[]"),
    session_id: str = Form(...),
):

    try:

       if not session_id:
        session_id = str(uuid.uuid4())
        create_chat_session(session_id)

       conversation = get_chat_history(session_id)

       if not isinstance(conversation, list):
        conversation = []

       save_messages(
        session_id, 
        "user",
        message
       ) 

        # ----------------------------------------------------
        # BUILD CLEAN LANGCHAIN MESSAGE HISTORY
        # ----------------------------------------------------

       messages = []

       for item in conversation:
        if not isinstance(item ,dict):
            continue
        role = item.get("role")
        content = item.get("message")    


            # Only allow actual conversation messages.
        if  not content:
            continue

        if role == "user":
             message.append({
                 "role":"user",
                 "content":content
            })
                    
        elif role == "assistant":
            mesaage.append({
                "role":"assistant",
                "content": content
            })   
       messages.append({
        "role":"user",
        "content":message
    })


       result = agent.invoke({
        "message":messages
    })

       response = extract_response(result)


       save_message(
         session_id,
         "assistant",
         response
    )

       return {
         "session_id": session_id,
         "response": response
    }
    except Exception as e:
        return {
          "error": str(e)
    }    


        # ----------------------------------------------------
        # MAKE SURE CURRENT MESSAGE EXISTS
        # ----------------------------------------------------

        if (
            not messages
            or messages[-1].get(
                "content"
            ) != message
        ):

            messages.append(
                {
                    "role": "user",
                    "content": message,
                }
            )


        # ----------------------------------------------------
        # RUN AGENT WITH COMPLETE CONVERSATION
        # ----------------------------------------------------



# ============================================================
# IMAGE SEARCH
# ============================================================

@app.post("/image-search")
async def image_search(
    file: UploadFile = File(...),
):

    suffix = (
        os.path.splitext(
            file.filename or ""
        )[1]
        or ".jpg"
    )


    temp_path = None


    try:

        # ----------------------------------------------------
        # SAVE UPLOADED IMAGE TEMPORARILY
        # ----------------------------------------------------

        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
        ) as tmp:

            file_data = await file.read()

            tmp.write(
                file_data
            )

            temp_path = tmp.name


        # ----------------------------------------------------
        # CREATE IMAGE SEARCH PROMPT
        # ----------------------------------------------------

        prompt = (
            "I uploaded a product image. "
            "Please analyze it and find similar "
            "products in the store. "
            f"Image path: {temp_path}"
        )


        # ----------------------------------------------------
        # RUN AGENT
        # ----------------------------------------------------

        result = agent.invoke(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ]
            }
        )


        # ----------------------------------------------------
        # EXTRACT ONLY AI RESPONSE
        # ----------------------------------------------------

        response = extract_response(
            result
        )


        return {
            "success": True,
            "response": response,
        }


    except Exception as e:

        return {
            "success": False,
            "response": (
                "Image analysis error: "
                f"{str(e)}"
            ),
        }


    finally:

        # ----------------------------------------------------
        # DELETE TEMPORARY IMAGE
        # ----------------------------------------------------

        if (
            temp_path
            and os.path.exists(
                temp_path
            )
        ):

            try:

                os.remove(
                    temp_path
                )

            except OSError:

                pass