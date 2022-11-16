const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();
const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rhdmhm3.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
   try {
      const appointmentOptionCollection = client.db('doctorsPortal').collection('appointmentOptions');
      const bookingsCollection = client.db('doctorsPortal').collection('bookings');

      // Use Aggregate to query multiple collection and then merge data
      app.get('/appointmentOptions', async (req, res) => {
         const date = req.query.date;
         const query = {};
         const options = await appointmentOptionCollection.find(query).toArray();
         // akoi din a time akta ni felle sheta jate ar ui te na dekhai tai..karon akoi time a 2jn patient not possible
         // get the bookings of the provided date
         const bookingQuery = { appointmentDate: date }
         const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();

         // code carefully :D
         options.forEach(option => {
            const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
            const bookedSlots = optionBooked.map(book => book.slot)
            const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
            option.slots = remainingSlots;
            // console.log(date, option.name, remainingSlots.length);
         })
         res.send(options);
      })


      // localField holo ja data ta insert korlam oitar name ar sathe ...Foreign field mani order dewar por ja data pachi oitar treatment ar sathe milabo
      // appointmentOptions name ar sathe bookings ar treatment milabo

      app.get('/v2/appointmentOptions', async (req, res) => {
         const date = req.query.date;
         const options = await appointmentOptionCollection.aggregate([
            {
               $lookup: {
                  from: 'bookings',
                  localField: 'name',
                  foreignField: 'treatment',
                  pipeline: [
                     {
                        $match: {
                           $expr: {
                              $eq: ['$appointmentDate', date]
                           }
                        }
                     }
                  ],
                  as: 'booked'
               }
            },
            {
               $project: {
                  name: 1,
                  slots: 1,
                  booked: {
                     $map: {
                        input: '$booked',
                        as: 'book',
                        in: '$$book.slot'
                     }
                  }
               }
            },
            {
               $project: {
                  name: 1,
                  slots: {
                     $setDifference: ['$slots', '$booked']
                  }
               }
            }
         ]).toArray();
         res.send(options);
      })

      /* 
      * API Naming Convention
      * app.get('/bookings')
      * app.get('/bookings/:id')
      * app.post('/bookings')
      * app.patch('/bookings/:id')
      * app.delete('/bookings/:id')
      */

      app.post('/bookings', async (req, res) => {
         const booking = req.body;
         console.log(booking);
         const query = {
            appointmentDate: booking.appointmentDate,
            email: booking.email,
            treatment: booking.treatment
         }

         const alreadyBooked = await bookingsCollection.find(query).toArray();

         if(alreadyBooked.length)
         {
            const message = `You already have a booking on ${booking.appointmentDate}`
            return res.send({acknowledged: false, message})
         }

         const result = await bookingsCollection.insertOne(booking);
         res.send(result);
      })

   }
   finally {

   }
}
run().catch(console.log);

app.get('/', async (req, res) => {
   res.send('doctors portal server is running');
})

app.listen(port, () => console.log(`Doctors portal running on ${port}`))