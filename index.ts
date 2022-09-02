import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import fuzzyset from 'fuzzyset.js';
import { get } from 'lodash';
import iconv from 'iconv-lite';
import prompt from 'prompt';
import yaml from 'js-yaml';

try {
    const config: any = yaml.load(fs.readFileSync('./config.yaml', 'utf8'));
    const buffer = fs.readFileSync(config.db);
    const db = iconv.decode(buffer, 'windows-1252');
    const parser = new XMLParser({ ignoreAttributes: false, parseAttributeValue: true });
    const parsedDb = parser.parse(db);
    const games = get(parsedDb, 'menu.game', []);

    const processType = config.type;
    const processSettings = config[processType];
    const folder = processSettings.folder;
    const output = processSettings.output;
    const fileExtension = `.${processSettings.format}`;

    const names: any[] = [];
    const nameMap: any = {};
    games.forEach((game: any) => {
        // Add to array
        addToArray(names, game.description, nameMap, game);
    });

    // Create a fuzzy set from the names
    const nameSet = fuzzyset(names);

    // Get all the files from the folder
    const promptInfo: any = {
        properties: {},
    };
    const matchMap: any = {};
    const files = fs.readdirSync(folder);
    files.forEach(file => {
        // Do not process anything but the files with a matching extension
        if (!file.endsWith(fileExtension)) {
            return;
        }

        // What file are we checking?
        console.log(`Checking: ${file}...`);

        // Get fuzzy matches
        const fileName = file.replace(fileExtension, '');
        const matches = nameSet.get(fileName);

        if (!matches?.length) {
            return;
        }

        // Add match details
        const gameName = get(matches, [0, 1], '');
        promptInfo.properties[fileName] = {
            description: `${fileName} ==> ${gameName}\nDo you want to rename the file?`,
            message: 'Must choose (y)es or (n)o',
            default: config['default-selection'],
            required: true,
            pattern: /^[y|n|Y|N]$/
        };
        matchMap[fileName] = gameName;
    })

    prompt.start();
    prompt.get(promptInfo, (err, result) => {
        if (err) {
            console.error(err);
            return;
        }

        Object.keys(result).forEach(key => {
            if (result[key].toString().toLowerCase() !== 'y') {
                console.log(`Skipping ${key}...`);
                return;
            }

            console.log(`Copying: ${key} => ${matchMap[key]}`);
            renameFile(matchMap, key, folder, key, fileExtension, output);
        });
    });

} catch (error) {
    console.log(error);
}

function renameFile(nameMap: any, gameName: string, folder: any, fileName: string, fileExtension: string, output: any) {
    const gameDescription = nameMap[gameName];
    const oldFile = `${folder}${fileName}${fileExtension}`;
    const newFile = `${output}${gameDescription}${fileExtension}`;
    fs.renameSync(oldFile, newFile);

    // Log what we did
    console.log(`Copied: ${oldFile} ==> ${newFile}`);
}

function addToArray(names: any[], name: any, nameMap: any, game: any) {
    names.push(name);

    // Map name to description
    nameMap[name] = game.description;

    // Show the name we just processed
    console.log(`Added: ${name}`);
}
