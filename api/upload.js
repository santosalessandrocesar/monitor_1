import formidable from 'formidable';
import fs from 'fs';
import csv from 'csv-parser';
import net from 'net';

export const config = {
  api: {
    bodyParser: false, // importante para upload de arquivos
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const form = new formidable.IncomingForm();

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ message: 'Erro no upload' });
    }

    const file = files.file[0].filepath;

    const results = [];

    fs.createReadStream(file)
      .pipe(csv())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', async () => {
        const checks = await Promise.all(
          results.map(async ({ loja, ip }) => {
            const status = await checkIP(ip);
            return { loja, ip, status };
          })
        );

        res.status(200).json(checks);
      });
  });
}

function checkIP(ip) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000; // 2 segundos
    let isOnline = false;

    socket.setTimeout(timeout);
    socket.on('connect', () => {
      isOnline = true;
      socket.destroy();
    });
    socket.on('timeout', () => {
      socket.destroy();
    });
    socket.on('error', () => {
      socket.destroy();
    });
    socket.on('close', () => {
      resolve(isOnline ? 'Online' : 'Offline');
    });

    socket.connect(80, ip); // Porta 80
  });
}
