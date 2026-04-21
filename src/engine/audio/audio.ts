import { type IMediaInstance, type PlayOptions, type Sound, sound } from '@pixi/sound';
import gsap from 'gsap';
import { Assets } from 'pixi.js';

/**
 * Handles music background, playing only one audio file in loop at time,
 * and fade/stop the music if a new one is requested. Also provide volume
 * control for music background only, leaving other sounds volumes unchanged.
 */
export class BGM {
  /** Alias of the current music being played */
  public currentAlias?: string;
  /** Current music instance being played */
  public current?: Sound;
  private currentInstance: IMediaInstance | null = null;
  /** Current volume set */
  private volume = 1;

  /** Play a background music, fading out and stopping the previous, if there is one */
  public async play(alias: string, options?: PlayOptions, duration = 1) {
    // Do nothing if the requested music is already being played
    if (this.currentAlias === alias) return;

    // Fade out then stop current music
    if (this.current) {
      const current = this.current;
      gsap.to(current, { volume: 0, duration, ease: 'none' }).then(() => {
        current.stop();
      });
    }

    // Find out the new instance to be played
    this.current = sound.exists(alias) ? sound.find(alias) : Assets.get<Sound>(alias);

    // Play and fade in the new music
    this.currentAlias = alias;
    this.currentInstance = await this.current.play({ loop: true, ...options });

    this.current.volume = 0;
    gsap.to(this.current, { volume: this.volume, duration, ease: 'none' });
  }

  public async syncPlay(alias: string, options?: PlayOptions) {
    const oldInstance = this.currentInstance;
    await this.play(alias, options);

    // TODO: мудацкий хак. Неплохо было бы потом разобраться, как лучше передавать прогресс
    // если не сработает, то нужно будет подписаться на событие 'progress'
    // внутри при апдейте: this.emit('progress', this._progress, duration);
    // и после этого передавать при создании синхронного трека значение опции start
    if (oldInstance && this.currentInstance) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.currentInstance as any)['_progress'] = oldInstance.progress;
    }
  }

  /** Get background music volume */
  public getVolume() {
    return this.volume;
  }

  /** Set background music volume */
  public setVolume(v: number) {
    this.volume = v;
    if (this.current) this.current.volume = this.volume;
  }

  public getCurrentProgress(): number {
    let progress = 0;

    /* if (this.currentInstance && this.current) {
      offset = this.currentInstance.progress * this.current.duration;
    } */

    if (this.currentInstance) {
      progress = this.currentInstance.progress;
    }

    return progress;
  }
}

/**
 * Handles short sound special effects, mainly for having its own volume settings.
 * The volume control is only a workaround to make it work only with this type of sound,
 * with a limitation of not controlling volume of currently playing instances - only the new ones will
 * have their volume changed. But because most of sound effects are short sounds, this is generally fine.
 */
export class SFX {
  /** Volume scale for new instances */
  private volume = 1;

  /** Play an one-shot sound effect */
  public async play(alias: string, options?: PlayOptions): Promise<IMediaInstance> {
    const volume = this.volume * (options?.volume ?? 1);
    const snd = sound.exists(alias) ? sound.find(alias) : Assets.get<Sound>(alias);
    const instance = await snd.play({ ...options, volume });

    return instance;
  }

  /** Set sound effects volume */
  public getVolume() {
    return this.volume;
  }

  /** Set sound effects volume. Does not affect instances that are currently playing */
  public setVolume(v: number) {
    this.volume = v;
  }

  public getSoundByAlias(alias: string): Sound {
    const targetSound = sound.find(alias);

    return targetSound;
  }
}
