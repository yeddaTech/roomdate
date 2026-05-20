# RoomDate 🏠

Un progetto nato per semplificare la ricerca di stanze in affitto e coinquilini in Italia, senza dover impazzire tra mille gruppi Facebook, agenzie e commissioni. 

Abbiamo costruito sia la parte di ricerca degli annunci (stile portale immobiliare) sia una parte per matchare i coinquilini, con tanto di chat in tempo reale integrata per parlarsi subito.

## Cosa c'è dentro

* **Ricerca 2 in 1:** Puoi cercare stanze filtrando per budget e città, oppure cercare direttamente profili di futuri coinquilini per prendere una casa insieme.
* **Chat Realtime:** Messaggistica istantanea implementata con Pusher (WebSockets). Abbiamo aggiunto un'interfaccia "ottimistica", quindi quando invii un messaggio appare subito a schermo zero attese (tipo WhatsApp).
* **Contesti Chat:** Il database è strutturato per separare le chat. Se contatti qualcuno per un annuncio, la chat ti ricorda di quale stanza state parlando. Se cerchi un coinquilino, crea una chat diretta tra utenti.
* **UI fluida:** Abbiamo inserito degli skeleton loaders animati ovunque per evitare schermate vuote o noiosi testi "caricamento in corso..." mentre le API o il database si svegliano.
* **Sicurezza base:** Il backend è protetto dalle classiche SQL Injection usando le query parametrizzate nativamente in Go.

## Stack Tecnologico

Per questo progetto abbiamo usato:
* **Frontend:** React + CSS custom (niente librerie pesanti per UI, abbiamo fatto a mano)
* **Backend:** Go (hostato come Serverless Functions)
* **Database:** PostgreSQL (hostato su Neon)
* **Infrastruttura:** Vercel e Pusher

## Come far girare il progetto in locale

Se vuoi scaricare il codice e farlo girare sul tuo PC:

1. Clona la repo e installa le dipendenze:
   ```bash
   git clone [https://github.com/yeddaTech/roomdate.git](https://github.com/yeddaTech/roomdate.git)
   cd roomdate
   npm install


---
Developed by [Younesse Eddassouli (@yeddaTech)](https://github.com/yeddaTech)
