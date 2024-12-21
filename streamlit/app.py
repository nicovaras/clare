import streamlit as st
import requests
import json
import os

BASE_URL = os.getenv("BASE_URL", "http://localhost:3000/api")

st.title("Message Classifier Service")

user_id = st.text_input("User ID", "123")
auth_id = st.text_input("Auth token", "abc123")

tab1, tab2, tab3, tab4 = st.tabs(["Send Message", "Initiate Check-In", "Get Context", "Update Context"])

def handle_response(response):
    if response.status_code == 200:
        return response.json()
    else:
        st.error(f"Error: {response.json().get('error', 'Unknown error')}")
        return None

def get_headers():
    return {"Authorization": f"Bearer {auth_id}"}

with tab1:
    st.header("Send Message")
    message = st.text_area("Enter your message")

    flow = st.selectbox("Select Flow", ["normal", "checkIn"], key="send_message_flow")

    if st.button("Send"):
        if user_id and message:
            response = requests.post(
                f"{BASE_URL}/send-message",
                headers=get_headers(),
                json={"userId": user_id, "message": message}
            )
            result = handle_response(response)
            if result:
                st.success(f"Response: {result['response']}")
                st.info(f"Category: {result['category']}")
                st.info(f"Flow: {result['flow']}")
                st.info(f"Conversation ID: {result['conversationId']}")

                # Fetch and display the updated conversation
                conversation_id = result['conversationId']
                conversation_key = f"context:{user_id}:{result['flow']}:{conversation_id}"
                
                st.subheader("Conversation History")
                conversation_response = requests.get(f"{BASE_URL}/get-context/{user_id}",
                                                     headers=get_headers())
                conversation_data = handle_response(conversation_response)
                if conversation_data:
                    conversations = conversation_data['contexts'].get(result['flow'], [])
                    for convo in conversations:
                        if convo['conversationId'] == conversation_id:
                            st.json(convo['messages'])
                            break
        else:
            st.warning("Please enter both User ID and Message.")

with tab2:
    st.header("Initiate Check-In")
    if st.button("Start Check-In"):
        if user_id:
            response = requests.post(
                f"{BASE_URL}/initiate-check-in",
                json={"userId": user_id},
                headers=get_headers()
            )
            result = handle_response(response)
            if result:
                st.success(f"Check-In Started: {result['message']}")
                st.info(f"Conversation ID: {result['conversationId']}")
        else:
            st.warning("Please enter a User ID.")

with tab3:
    st.header("Get Context")
    if st.button("Retrieve Context"):
        if user_id:
            response = requests.get(f"{BASE_URL}/get-context/{user_id}", headers=get_headers())
            result = handle_response(response)
            if result:
                st.info(f"Active Flow: {result['activeFlow']}")
                st.subheader("Normal Flow Conversations")
                normal_conversations = result['contexts'].get('normal', [])
                if normal_conversations:
                    for convo in normal_conversations:
                        st.write(f"**Conversation ID:** {convo['conversationId']}")
                        st.json(convo['messages'])
                else:
                    st.write("No normal flow conversations found.")

                st.subheader("Check-In Flow Conversations")
                check_in_conversations = result['contexts'].get('check-in', [])
                if check_in_conversations:
                    for convo in check_in_conversations:
                        st.write(f"**Conversation ID:** {convo['conversationId']}")
                        st.json(convo['messages'])
                else:
                    st.write("No check-in flow conversations found.")
        else:
            st.warning("Please enter a User ID.")


with tab4:
    st.header("Update Context")
    flow = st.selectbox("Select Flow", ["normal", "check-in"], key="update_context_flow")
    conversation_id = st.text_input("Conversation ID")
    context_update = st.text_area("Enter context updates as JSON")

    if st.button("Update Context"):
        if user_id and conversation_id and context_update:
            try:
                context_updates = json.loads(context_update)
                response = requests.post(
                    f"{BASE_URL}/update-context",
                    json={
                        "userId": user_id,
                        "flow": flow,
                        "conversationId": conversation_id,
                        "contextUpdates": context_updates
                    },
                    headers=get_headers()
                )
                result = handle_response(response)
                if result:
                    st.success(f"Context Updated: {result['contextUpdates']}")
            except json.JSONDecodeError as e:
                st.error(f"Invalid JSON format: {e}")
        else:
            st.warning("Please enter User ID, Conversation ID, and Context Updates.")
