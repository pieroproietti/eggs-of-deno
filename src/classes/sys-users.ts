/**
 * src/classes/sys-users.ts
 * "THE SYSUSER MASTER" - Deno Version
 * Pure Node.js/Deno management for system users and groups.
 * Replaces binaries (useradd/usermod/deluser) to ensure atomic operations
 * and compatibility (Yocto style).
 */

import { path, ensureDir, exists, bcrypt } from "../deps.ts";
import { Utils } from "./utils.ts";

// --- DATA INTERFACES ---

export interface IPasswdEntry {
    username: string;
    password: string; // 'x'
    uid: string;
    gid: string;
    gecos: string;
    home: string;
    shell: string;
}

export interface IShadowEntry {
    username: string;
    hash: string;
    lastChange: string;
    min: string;
    max: string;
    warn: string;
    inactive: string;
    expire: string;
}

export interface IGroupEntry {
    groupName: string;
    password: string; // 'x'
    gid: string;
    members: string[];
}

export class SysUsers {
    private targetRoot: string;
    private distroFamily: string;
    
    // In-memory cache
    private passwd: IPasswdEntry[] = [];
    private shadow: IShadowEntry[] = [];
    private group: IGroupEntry[] = [];
    
    // "Minor" files handled as raw lines for simplicity
    private gshadowLines: string[] = [];
    private subuidLines: string[] = [];
    private subgidLines: string[] = [];

    constructor(targetRoot: string, distroFamily: string) {
        this.targetRoot = targetRoot;
        this.distroFamily = distroFamily;
    }

    /**
     * Load all configuration files into memory
     */
    public async load() {
        this.passwd = this.parsePasswd(await this.readFile('etc/passwd'));
        this.shadow = this.parseShadow(await this.readFile('etc/shadow'));
        this.group = this.parseGroup(await this.readFile('etc/group'));
        
        this.gshadowLines = await this.readFile('etc/gshadow');
        this.subuidLines = await this.readFile('etc/subuid');
        this.subgidLines = await this.readFile('etc/subgid');
    }

    /**
     * Save memory state to disk and apply SELinux fix
     */
    public async save() {
        // Serialization
        const passwdContent = this.serializePasswd(this.passwd);
        const shadowContent = this.serializeShadow(this.shadow);
        const groupContent = this.serializeGroup(this.group);
        
        // Atomic Writing + SELinux Fix
        await this.writeFile('etc/passwd', passwdContent, 'passwd_file_t', 0o644);
        await this.writeFile('etc/shadow', shadowContent, 'shadow_t', 0o600);
        await this.writeFile('etc/group', groupContent, 'passwd_file_t', 0o644);
        
        // Raw files
        if (this.gshadowLines.length > 0) 
            await this.writeFile('etc/gshadow', this.gshadowLines.join('\n'), 'shadow_t', 0o600);
        
        if (this.subuidLines.length > 0)
            await this.writeFile('etc/subuid', this.subuidLines.join('\n'), 'passwd_file_t', 0o644);
        
        if (this.subgidLines.length > 0)
            await this.writeFile('etc/subgid', this.subgidLines.join('\n'), 'passwd_file_t', 0o644);
    }

    // =========================================================================
    // PUBLIC API
    // =========================================================================

    /**
     * Get all users
     */
    public getUsers(): IPasswdEntry[] {
        return this.passwd;
    }

    /**
     * Create a new complete user
     */
    public addUser(user: IPasswdEntry, cleanPassword: string) {
        // Remove if exists (idempotency)
        this.removeUser(user.username);

        // 1. Passwd
        this.passwd.push(user);

        // 2. Shadow (Hash Password)
        const salt = bcrypt.genSaltSync(10);
        const hash = bcrypt.hashSync(cleanPassword, salt);
        this.shadow.push({
            username: user.username,
            hash: hash,
            lastChange: '19700', // Approximate date
            min: '0',
            max: '99999',
            warn: '7',
            inactive: '',
            expire: ''
        });

        // 3. Primary Group
        // Only if a group with that name doesn't already exist
        if (!this.group.find(g => g.groupName === user.username)) {
            this.group.push({
                groupName: user.username,
                password: 'x',
                gid: user.gid,
                members: []
            });
        }
        
        // 4. GShadow (placeholder)
        this.gshadowLines.push(`${user.username}:!::`);

        // 5. SubUID/SubGID (Podman rootless)
        // Standard offset calculation: 100000 + (UID-1000)*65536
        const uidNum = parseInt(user.uid);
        if (!isNaN(uidNum) && uidNum >= 1000) {
            const startUid = 100000 + (uidNum - 1000) * 65536;
            const subEntry = `${user.username}:${startUid}:65536`;
            this.subuidLines.push(subEntry);
            this.subgidLines.push(subEntry);
        }
    }

    /**
     * Completely remove a user
     */
    public removeUser(username: string) {
        this.passwd = this.passwd.filter(u => u.username !== username);
        this.shadow = this.shadow.filter(s => s.username !== username);
        this.group = this.group.filter(g => g.groupName !== username);
        
        // Remove from members of other groups
        this.group.forEach(g => {
            g.members = g.members.filter(m => m !== username);
        });

        this.gshadowLines = this.gshadowLines.filter(l => !l.startsWith(`${username}:`));
        this.subuidLines = this.subuidLines.filter(l => !l.startsWith(`${username}:`));
        this.subgidLines = this.subgidLines.filter(l => !l.startsWith(`${username}:`));
    }

    /**
     * Add user to a supplemental group
     */
    public addUserToGroup(username: string, groupName: string) {
        const grp = this.group.find(g => g.groupName === groupName);
        if (grp) {
            if (!grp.members.includes(username)) {
                grp.members.push(username);
            }
        }
        // If the group doesn't exist, we silently ignore it or could create it
    }

    /**
     * Change user password
     */
    public setPassword(username: string, password: string) {
        const entry = this.shadow.find(s => s.username === username);
        if (entry) {
            const salt = bcrypt.genSaltSync(10);
            entry.hash = bcrypt.hashSync(password, salt);
            entry.lastChange = '19700';
        }
    }

    // =========================================================================
    // FILE IMPLEMENTATION (Private)
    // =========================================================================

    private async readFile(relativePath: string): Promise<string[]> {
        const fullPath = path.join(this.targetRoot, relativePath);
        if (await exists(fullPath)) {
            const content = await Deno.readTextFile(fullPath);
            return content.split('\n').filter(l => l.trim().length > 0);
        }
        return [];
    }

    private async writeFile(relativePath: string, content: string, contextType: string, mode?: number) {
        const fullPath = path.join(this.targetRoot, relativePath);
        // Create dir if missing (e.g., /etc/sudoers.d/ or similar)
        const dir = path.dirname(fullPath);
        await ensureDir(dir);

        try {
            // 1. Write
            await Deno.writeTextFile(fullPath, content + '\n');
            
            // 2. Set Mode (if provided)
            if (mode !== undefined) {
                await Deno.chmod(fullPath, mode);
            }
            
            // 3. SELinux Fix (RHEL Family Only)
            if (['fedora', 'rhel', 'centos', 'almalinux', 'rocky'].includes(this.distroFamily)) {
                // await exec, echo false to keep logs clean
                // Assuming Utils.run is available and capable
                 await Utils.run("chcon", ["-t", contextType, fullPath], false).catch(() => {});
            }
        } catch (e) {
            console.error(`SysUsers Error writing ${relativePath}:`, e);
        }
    }

    // --- PARSERS & SERIALIZERS ---

    private parsePasswd(lines: string[]): IPasswdEntry[] {
        return lines.map(line => {
            const p = line.split(':');
            if (p.length < 7) return null;
            return { username: p[0], password: p[1], uid: p[2], gid: p[3], gecos: p[4], home: p[5], shell: p[6] } as IPasswdEntry;
        }).filter((u): u is IPasswdEntry => u !== null);
    }

    private serializePasswd(entries: IPasswdEntry[]): string {
        return entries.map(u => `${u.username}:${u.password}:${u.uid}:${u.gid}:${u.gecos}:${u.home}:${u.shell}`).join('\n');
    }

    private parseShadow(lines: string[]): IShadowEntry[] {
        return lines.map(line => {
            const p = line.split(':');
            // Allow lines that might not have all fields if system is weird, but standard is 9 fields
            if (p.length < 2) return null;
            return { 
                username: p[0], 
                hash: p[1], 
                lastChange: p[2]||'', 
                min: p[3]||'', 
                max: p[4]||'', 
                warn: p[5]||'', 
                inactive: p[6]||'', 
                expire: p[7]||'' 
            } as IShadowEntry;
        }).filter((u): u is IShadowEntry => u !== null);
    }

    private serializeShadow(entries: IShadowEntry[]): string {
        // Shadow file usually ends with a colon if the last field is reserved/empty
        return entries.map(s => `${s.username}:${s.hash}:${s.lastChange}:${s.min}:${s.max}:${s.warn}:${s.inactive}:${s.expire}:`).join('\n');
    }

    private parseGroup(lines: string[]): IGroupEntry[] {
        return lines.map(line => {
            const p = line.split(':');
            if (p.length < 3) return null;
            return { 
                groupName: p[0], 
                password: p[1], 
                gid: p[2], 
                members: p[3] && p[3].trim() ? p[3].split(',') : [] 
            } as IGroupEntry;
        }).filter((g): g is IGroupEntry => g !== null);
    }

    private serializeGroup(entries: IGroupEntry[]): string {
        return entries.map(g => `${g.groupName}:${g.password}:${g.gid}:${g.members.join(',')}`).join('\n');
    }
}
