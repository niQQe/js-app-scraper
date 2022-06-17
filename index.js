import fetch from 'node-fetch';
import dotenv from 'dotenv/config';
import nodemailer from 'nodemailer';
import ioredis from 'ioredis';

const db = new ioredis(
	'redis://:pc29efd960e273ae0b08f7da23364711d84321bf819e560f7654cff3a18bb99d8@ec2-52-211-5-96.eu-west-1.compute.amazonaws.com:7429'
);
// const client = new ioredis(process.env.REDIS_URL);

const rooms = 4;
const targets = {
	Finfast: {
		url: 'https://finfast.se/lediga-objekt',
		scrapeFilter: (text) => {
			const apps = text
				.replace(/\n|\t/g, '')
				.trim()
				.match(/<dt class="title">(.*?)<\/dt>/g)
				.map((val) => /<strong>(.*?)<\/strong>/g.exec(val)[0].replace(/<strong>|<\/strong>/g, ''))
				.filter((app) => +app[0][0] === rooms).join`\n`;
			return apps.length ? apps : '';
		},
	},
	Lundbergs: {
		url: `https://www.lundbergsfastigheter.se/bostad/lediga-lagenheter/orebro?rum=${rooms}`,
		scrapeFilter: (text) => {
			const apps = text
				.replace(/\n|\t/g, '')
				.trim()
				.match(/<td>(.*?)<\/td>/g)
				.filter((row) => !row.includes('button'))
				.map((row) => {
					const parsedRow = row
						.replace(/<td>|<\/td|<span>|<\/span>|\>|<\/a|<!-- --/g, '')
						.replace(/<a/, ' %');
					const indexOfSpecialChar = parsedRow.indexOf('%');
					return indexOfSpecialChar != -1 ? parsedRow.slice(0, indexOfSpecialChar).trim() : parsedRow;
				})
				.reduce((acc, curr, index) => {
					if (index != 0 && index % 5 === 0) curr = ',' + curr;
					acc += ' ' + curr;
					return acc;
				}, '').split`,`
				.map((t) => t.trim())
				.filter((row) => row.includes(`Rum:${rooms}`)).join`\n`;
			return apps.length ? apps : '';
		},
	},
};

const getScrapedAppartments = async () => {
	let result = {};
	for (const propertyOwner in targets) {
		const html = await (await fetch(targets[propertyOwner].url)).text();
		const scrapeData = targets[propertyOwner].scrapeFilter(html);
		result[propertyOwner] = scrapeData;
	}
	return result;
};

const generateMessage = (text) => {
	let message = '';
	for (let propertyOwner in text) message += `${propertyOwner}\n${text[propertyOwner]}\n\n`;
	return message;
};

const sendMail = (available) => {
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: process.env.user,
			pass: process.env.pass,
		},
	});
	transporter.sendMail({
		from: 'nickewideving@gmail.com',
		to: 'nickewideving@gmail.com',
		subject: 'Lediga 4or!!',
		text: generateMessage(available),
	});
};

const checkDB = async (scrapeData) => {
	const keys = await db.keys('*');
	const storedData = await keys.reduce(async (accPromise, key) => {
		const data = await accPromise;
		data[key] = await db.get(key);
		return data;
	}, Promise.resolve({}));

	/** If data is the same as the stored data return null */
	if (JSON.stringify(scrapeData) === JSON.stringify(storedData)) return null;

	/** if not same, override new data in database and return the scrapedData */
	for (const propertyOwner in scrapeData) {
		db.set(propertyOwner, scrapeData[propertyOwner]);
	}
	return scrapeData;
};

async function runScraper() {
	const scrapeData = await getScrapedAppartments();
	const available = await checkDB(scrapeData);
	if (available) {
		console.log('New appartments found');
		sendMail(available);
	} else {
		console.log('No available appartments :(');
	}
	db.quit();
}

runScraper();
