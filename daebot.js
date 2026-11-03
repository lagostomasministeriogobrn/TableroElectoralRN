import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pregunta, datosElectorales } = req.body;

  if (!pregunta || !datosElectorales) {
    return res.status(400).json({ error: 'Faltan datos o pregunta' });
  }

  try {
    // Inicializamos Gemini de forma segura en el servidor de Vercel
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const promptSistema = `Sos DAEBot, el Asistente Oficial e Inteligente de la Dirección de Asuntos Electorales de la Provincia de Río Negro. 
    Tenés acceso a la base de datos completa de resultados electorales en formato JSON provista abajo. 
    Respondé con absoluta precisión matemática, realizá comparaciones cruzadas avanzadas entre localidades, circuitos, partidos y categorías cuando te lo pidan. 
    Usá formato claro, profesional y estructurado con negritas.
    
    DATOS DE SUPABASE:
    ${JSON.stringify(datosElectorales)}
    
    Pregunta del usuario: ${pregunta}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: promptSistema }] }]
    });

    const respuestaTexto = response.text || "No se pudo procesar la respuesta.";

    return res.status(200).json({ respuesta: respuestaTexto });

  } catch (error) {
    console.error("Error en servidor DAEBot:", error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}