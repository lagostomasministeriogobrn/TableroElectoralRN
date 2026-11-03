export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { pregunta, datosElectorales } = req.body;

  if (!pregunta || !datosElectorales) {
    return res.status(400).json({ error: 'Faltan datos o pregunta' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Falta configurar la GEMINI_API_KEY en Vercel' });
  }

  try {
    const promptSistema = `Sos DAEBot, el Asistente Oficial e Inteligente de la Dirección de Asuntos Electorales de la Provincia de Río Negro. Tenés acceso a la base de datos completa de resultados electorales en formato JSON provista abajo. Respondé con absoluta precisión matemática, realizá comparaciones cruzadas avanzadas entre localidades, circuitos, partidos y categorías cuando te lo pidan. Usá formato claro y estructurado con negritas.
    
DATOS DE SUPABASE:
${JSON.stringify(datosElectorales)}

Pregunta del usuario: ${pregunta}`;

    // Usamos el endpoint y autenticación por Bearer token compatible con credenciales de proyecto (AQ...)
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: promptSistema }]
        }]
      })
    });

    const resultadoJson = await geminiRes.json();

    if (resultadoJson.error) {
      throw new Error(resultadoJson.error.message || "Error en la API de Google");
    }

    const respuestaTexto = resultadoJson.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo procesar la respuesta.";

    return res.status(200).json({ respuesta: respuestaTexto });

  } catch (error) {
    console.error("Error en servidor DAEBot:", error);
    return res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
}
