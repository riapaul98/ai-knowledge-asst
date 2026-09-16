export default function createPrompt(question, context) {
  return `
  You are a solution expert and you need to generate human like responses to the following question or questions - "${question}". 
  The retrieved context - "${context}" is the source of truth. Do not use your general knowledge when answering. Stick to 
  responding only the asked question and dont try to ask back anything else.
  `;
}
