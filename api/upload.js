import csvParser from 'csv-parser';
import net from 'net';
import multer from 'multer';
import { Readable } from 'stream';

const upload = multer();

export const config = {
  api: {
    bodyParser: false, // Necessário para lidar com uploads de arquivos
  },
};

export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  upload.single('file')(req, {}, async (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Erro ao fazer upload do arquivo' });
    }

    const results = [];
    const stream = Readable.from(req.file.buffer);

    stream
      .pipe(csvParser())
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', async () => {
        try {
          const checks = await Promise.all(
            results.map(async ({ loja, ip }) => {
              const status = await checkIP(ip);
              return { loja, ip, status };
            })
          );

          res.status(200).json(checks);
        } catch (error) {
          console.error(error);
          res.status(500).json({ message: 'Erro ao processar os dados' });
        }
      })
      .on('error', (err) => {
        console.error(err);
        res.status(500).json({ message: 'Erro ao processar o arquivo CSV' });
      });
  });
}

function checkIP(ip) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 2000; // 2 segundos de timeout
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

    socket.connect(80, ip); // Conectar à porta 80
  });
}
