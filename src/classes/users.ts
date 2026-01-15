/**
 * src/classes/users.ts
 * Based on penguins-eggs v.25.7.x / ecmascript 2020
 * author: Piero Proietti
 * email: piero.proietti@gmail.com
 * license: MIT
 */

import { exists } from "../deps.ts";
import { Utils } from "./utils.ts";

/**
 * Users class
 */
export class Users {
  public gecos: string;
  public gid: string;
  public hasHome: boolean;
  public home: string;
  public login: string;
  public password: string;
  public saveIt: boolean;
  public shell: string;
  public size: number;
  public uid: string;

  constructor(login: string, password: string, uid: string, gid: string, gecos: string, home: string, shell: string) {
    this.login = login;
    this.password = password;
    this.uid = uid;
    this.gid = gid;
    this.gecos = gecos;
    this.home = home;
    this.shell = shell;
    this.size = 0;
    this.hasHome = false;
    this.saveIt = false;
  }

  /**
   * getValues
   */
  async getValues() {
    const fLevels = [
      { path: 'bin', saveIt: false },
      { path: 'boot', saveIt: false },
      { path: 'dev', saveIt: false },
      { path: 'etc', saveIt: false },
      { path: 'lib', saveIt: false },
      { path: 'lib32,', saveIt: false },
      { path: 'libx32', saveIt: false },
      { path: 'lib64', saveIt: false },
      { path: 'home', saveIt: true },
      { path: 'media', saveIt: false },
      { path: 'mnt', saveIt: false },
      { path: 'opt', saveIt: true },
      { path: 'proc', saveIt: false },
      { path: 'root', saveIt: false },
      { path: 'run', saveIt: false },
      { path: 'sbin', saveIt: false },
      { path: 'sys', saveIt: false },
      { path: 'srv', saveIt: true },
      { path: 'tmp', saveIt: false },
      { path: 'usr', saveIt: true },
      { path: 'var', saveIt: true }
    ];

    let hasHome = false;
    let saveIt = false;
    let size = 0;

    // Only users not services
    if (parseInt(this.uid) >= 1000) {
      if (this.home != undefined) {
        /**
         * analyze firstLevel and
         * excluded to be saved
         */
        const fLevel = this.home.split('/')[1];
        for (const fLevel_ of fLevels) {
          if (fLevel_.path === fLevel) {
            saveIt = fLevel_.saveIt;
          }
        }

        /**
         * analize second level
         * examples: /var/run, /var/cache, /var/spool, etc
         */
        if (saveIt) {
          const sLevel = this.home.split('/')[2];
          if (sLevel === 'cache' || sLevel === 'run' || sLevel === 'spool') {
            saveIt = false;
          }
        }

        /**
         * exclude to save if home don't exist
         */
        if (!(await exists(this.home))) {
          saveIt = false;
        }

        /**
         * others motivations to exclude
         */
        if (saveIt) {
          switch (this.home) {
            /**
             * exclude always /
             */
            case '/': {
              break;
            }

            /**
             * excludes: under /usr
             */
            case '/usr/bin':
            case '/usr/sbin': {
              saveIt = false;
              break;
            }

            /**
             * excludes: under var
             */
            case '/var/backups':
            case '/var/lib/colord':
            case '/var/lib/geoclue':
            case '/var/lib/misc':
            case '/var/mail': {
              saveIt = false;
              break;
            }

            default: {
              if (await exists(this.home)) {
                hasHome = true;
                // Use Utils.run to execute shell command
                // du --block-size=1 --summarize ${this.home} | awk '{print $1}'
                const cmd = `du --block-size=1 --summarize ${this.home} | awk '{print $1}'`;
                const result = await Utils.run("sh", ["-c", cmd]);
                
                if (result.success && result.out) {
                   const parsedSize = parseInt(result.out.trim());
                   if (!isNaN(parsedSize)) {
                       size = parsedSize;
                   }
                }
              }

              saveIt = true;
              break;
            }
          }
        }
      }

      this.saveIt = saveIt;
      this.size = size;
      this.hasHome = hasHome;
    }
  }

  /**
   * create
   * @param root Chroot root path (optional)
   */
  async create(root = ""): Promise<boolean> {
    const cmdPrefix = root ? `chroot ${root} ` : "";
    
    try {
      // 1. Create Group
      // groupadd -g <gid> <login>
      await Utils.run("sh", ["-c", `${cmdPrefix}groupadd -g ${this.gid} ${this.login}`]);

      // 2. Create User
      // useradd -u <uid> -g <gid> -c "<gecos>" -d "<home>" -s "<shell>" -m <login>
      const cmdUserAdd = `${cmdPrefix}useradd -u ${this.uid} -g ${this.gid} -c "${this.gecos}" -d "${this.home}" -s "${this.shell}" -m ${this.login}`;
      await Utils.run("sh", ["-c", cmdUserAdd]);

      // 3. Set Password
      // echo "<login>:<password>" | chpasswd
      const cmdPasswd = `echo "${this.login}:${this.password}" | ${cmdPrefix}chpasswd`;
      await Utils.run("sh", ["-c", cmdPasswd]);

      // 4. Add to sudo group (Debian/Ubuntu specific usually)
      await Utils.run("sh", ["-c", `${cmdPrefix}usermod -aG sudo ${this.login}`]);
      
      return true;
    } catch (e) {
      console.error(`Error creating user ${this.login}:`, e);
      return false;
    }
  }
}
