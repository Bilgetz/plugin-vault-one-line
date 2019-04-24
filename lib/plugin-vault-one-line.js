'use babel';

import PluginVaultOneLineView from './plugin-vault-one-line-view';
import { CompositeDisposable, Range } from 'atom';
import configSchema from "./config-schema";

export default {

  subscriptions: null,
  config: configSchema,

  activate(state) {
    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'plugin-vault-one-line:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.subscriptions.dispose();
  },

  serialize() {
    return {};
  },

  toggle() {
    if (editor = atom.workspace.getActiveTextEditor()) {
        let linePoint = editor.getCursorBufferPosition();
        let row = linePoint.row;
        var rangeLine = new Range(editor.clipBufferPosition([row, 0]) , editor.clipBufferPosition([row, Infinity]));
        let lineText = editor.getTextInBufferRange(rangeLine);

        var myRegexp = /^(\s*[-]*\s*)([a-zA-Z0-9_-]+):\s+(!vault){0,1}\s*([|]){0,1}(.*)/g;
        match = myRegexp.exec(lineText);

        if(match!= null) {
          var prefix = match[1];
          var variableName = match[2];
          var variableVault = match[3];
          var variableMultiline = match[4];
          var variableValue = match[5];
          //console.log(variableName);
          //console.log(variableValue);
          //console.log(variableVault);
          //console.log(variableMultiline);
          if(variableValue === undefined)  {
            return;
          }

          if(variableMultiline !== undefined) {
            multipleVariable = [];
            var i = row + 1;
            nextLine = editor.lineTextForBufferRow(i)
            //console.log('nextLine=' + nextLine);
            var spaceRegex = /(\s+).*/g;
            var startingSpace= spaceRegex.exec(nextLine)[1];
            do {
              multipleVariable.push(nextLine.trim());
              i++;
              nextLine = editor.lineTextForBufferRow(i)
            } while (nextLine.startsWith(startingSpace));
            //console.log('multipleVariable=' + multipleVariable);
            variableValue=  multipleVariable.join('\n');
            rangeLine = new Range(editor.clipBufferPosition([row, 0]) , editor.clipBufferPosition([i-1, Infinity]))
          }

          variableValue = variableValue.trim();

          if(variableValue.startsWith('"')) {
            variableValue = variableValue.slice(1,-1).replace(/\\"/g, '"');
          }
          if(variableValue.startsWith("'")) {
            variableValue = variableValue.slice(1,-1).replace(/\\'/g, "'");
          }

          //console.log('variableValue='+  variableValue);

          if(variableVault === undefined) {
            this.vaultLine(rangeLine,prefix,variableName,variableValue);
          } else {
            this.unvaultLine(rangeLine,prefix,variableName,variableValue);
          }
        }


    }

  },
  vaultLine(rangeLine, prefix, variableName, variableValue) {
    let projectPath = atom.project.relativizePath('/')[0];
    const execChild = require('child_process').exec;
    let passwordFile = atom.config.get('plugin-vault-one-line.vault_password_file_path')
    let cmd = atom.config.get('plugin-vault-one-line.path');
    let batchCmd = "echo -n \""+ variableValue.replace(/"/g, '\\"').replace(/`/g, "\\`") + "\" | " + cmd + " encrypt_string --vault-id " + passwordFile + " --stdin-name '"+ variableName +"'";
    execChild(batchCmd, { cwd: projectPath } ,(error, stdout, stderr) => {
        if (error) {
            atom.notifications.addError("command: " + batchCmd +"\n" + stderr, { dismissable: true });
        } else {
            //console.log(stdout);
            editor.setTextInBufferRange(rangeLine, (prefix === undefined? '': prefix) + stdout)
        }
    });

  },
  unvaultLine(rangeMultipleLine, prefix, variableName, variableValue) {
    let projectPath = atom.project.relativizePath('/')[0];
    const execChild = require('child_process').exec;
    let passwordFile = atom.config.get('plugin-vault-one-line.vault_password_file_path')
    let cmd = atom.config.get('plugin-vault-one-line.path');
    let batchCmd = "echo '"+ variableValue + "' | " + cmd + " decrypt --vault-id " + passwordFile + " ";
    execChild(batchCmd, { cwd: projectPath } ,(error, stdout, stderr) => {
        if (error) {
            atom.notifications.addError("command: " + batchCmd +"\n" + stderr, { dismissable: true });
        } else {
            //console.log(stdout);
            var uncryptValue = stdout.trim();
            if(uncryptValue.includes("\n")) {
                var uncryptValueArray= uncryptValue.split("\n").map((s) => "    " + s );
                uncryptValueArray.unshift("|");
                uncryptValue = uncryptValueArray.join("\n");
            } else {
                uncryptValue= "'" + uncryptValue.replace(/'/g, "\\'") + "'";
            }
            editor.setTextInBufferRange(rangeMultipleLine, (prefix === undefined? '': prefix) + variableName + ": " + uncryptValue + "");
        }
    });
  }

};
