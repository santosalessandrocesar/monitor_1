import csvParser from 'csv-parser';
import net from 'net';
import { PassThrough } from 'stream';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const results = [];

  const stream = new PassThrough();
  req.pipe(stream);

  stream
    .pipe(csvParser())
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', async () => {
      const checks = await Promise.all(
        results.map(async ({ loja, ip }) => {
          const status = await checkIP(ip);
          return { loja: loja || 'Desconhecida', ip: ip || 'IP não informado', status };
        })
      );

      res.status(200).json(checks);
    })
    .on('error', (err) => {
      console.error(err);
      res.status(500).json({ message: 'Erro ao processar o CSV' });
    });
}

function checkIP(ip) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000;

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

    socket.connect(80, ip);
  });
}
