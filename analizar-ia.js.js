export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { pregunta, datosElectorales } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ respuesta: 'Error: No se encontró la GEMINI_API_KEY configurada en Vercel.' });
    }

    // Filtramos un resumen liviano para que la API responda rápido sin fallar por tamaño
    const datosResumidos = (datosElectorales || []).slice(0, 40).map(d => ({
        localidad: d.localidad,
        circuito: d.circuito_id,
        categoria: d.categoria,
        lista: d.nombre_lista || d.lista_id,
        votos: d.votos
    }));

    const prompt = `Eres un analista electoral oficial de Río Negro. 
Responde de forma breve y precisa a la pregunta usando estos datos reales de Supabase:
${JSON.stringify(datosResumidos)}

Pregunta del usuario: ${pregunta}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const respuestaTexto = data.candidates?.[0]?.content?.parts?.[0]?.text || "No se pudo obtener una respuesta clara de la IA.";
        
        return res.status(200).json({ respuesta: respuestaTexto });
    } catch (error) {
        return res.status(500).json({ respuesta: 'Error de conexión con el servicio de Gemini.' });
    }
}