sudo apt update
# Install Node.js (Current LTS recommended)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y node.js git nginx
# Install PM2 to manage the background process
sudo npm install -g pm2

cd /var/www
git clone https://github.com/eliasewu/net2app.com.git
cd net2app.com

# Create the environment file as per your README
nano .env.local

VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://your-api-url.com

npm install
npm run build
sudo nano /etc/nginx/sites-available/net2app
server {
    listen 80;
    server_name yourdomain.com; # Replace with your domain or IP

    root /var/www/net2app.com/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Connectivity for potential backend synchronization
    location /api/ {
        proxy_pass http://localhost:5000; # Adjust if your backend is on a different port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

sudo ln -s /etc/nginx/sites-available/net2app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

chmod +x deploy.sh
./deploy.sh



**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
