#!/usr/bin/env node

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = 'AIzaSyAWSIYXnhmoHDDVfPKfHABuhFrwaY5W8nA';

async function testModels() {
  try {
    console.log('Testing available Gemini models...\n');
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Try common model names
    const modelsToTry = [
      'gemini-pro',
      'gemini-1.5-pro',
      'gemini-1.0-pro',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest'
    ];
    
    for (const modelName of modelsToTry) {
      try {
        console.log(`Trying ${modelName}...`);
        const model = genAI.getGenerativeModel({ 
          model: modelName,
          generationConfig: {
            temperature: 0.7,
            topP: 0.8,
            maxOutputTokens: 50,
          }
        });
        
        const result = await model.generateContent('Respond with just "OK" to test this model');
        const response = result.response.text();
        console.log(`✅ ${modelName} works! Response: "${response.trim()}"`);
        
        // Test with a service-focused prompt
        const serviceTest = await model.generateContent('You are Maya, a business assistant for Soko Connect. A user says "hi". Respond professionally and guide them to shop or check balance. Keep under 50 characters.');
        const serviceResponse = serviceTest.response.text();
        console.log(`   Service test: "${serviceResponse.trim().substring(0, 80)}..."`);
        console.log('');
        break;
        
      } catch (error) {
        console.log(`❌ ${modelName} failed: ${error.message.substring(0, 100)}...`);
      }
    }
  } catch (error) {
    console.log('❌ General error:', error.message);
  }
}

testModels().catch(console.error);